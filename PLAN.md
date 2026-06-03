# PLANO DE ESCALABILIDADE - ZapAgenda Backend

> **Documento de referência para todas as melhorias de arquitetura**
> Última atualização: Junho 2026

---

## STATUS GERAL

| Fase | Nome | Status | Prioridade |
|------|------|--------|------------|
| 0 | Auditoria Técnica | 🔴 Pendente | **CRÍTICA** |
| 0.5 | Índices do Banco | 🔴 Pendente | **CRÍTICA** |
| 0.7 | Pooling PostgreSQL | 🔴 Pendente | **CRÍTICA** |
| 2 | Proteção Dupla Reserva | 🔴 Pendente | **CRÍTICA** |
| 1 | Setup Upstash Redis | 🔴 Pendente | Alta |
| 3 | Rate Limiting | 🔴 Pendente | Média |
| 4 | Cache de Slots | 🔴 Pendente | Média |
| 4.5 | Observabilidade | 🔴 Pendente | Média |
| 5 | Filas com QStash | 🔴 Pendente | Baixa |
| 6 | Cache Estático | 🔴 Pendente | Baixa |

---

## FASE 0: AUDITORIA TÉCNICA

### Objetivo
Mapear todos os problemas antes de qualquer alteração.

### Checklist de Auditoria

#### Queries sem índices adequados
- [ ] `appointments` - queries por establishment_id, date, professional_id
- [ ] `subscriptions` - queries por userId, status
- [ ] `clients` - queries por establishmentId, phone
- [ ] `services` - queries por establishmentId
- [ ] `professionals` - queries por establishmentId

#### Race conditions identificadas
- [ ] Agendamento simultâneo no mesmo horário
- [ ] Criação de trial duplicado
- [ ] Webhook Mercado Pago duplicado
- [ ] Booking público sem idempotência

#### Consultas N+1
- [ ] Listagem de agendamentos com include
- [ ] Listagem de profissionais com serviços
- [ ] Dashboard com múltiplas queries

#### Operações para cache
- [ ] Cálculo de slots disponíveis
- [ ] Dados do estabelecimento público
- [ ] Lista de planos
- [ ] Configurações do sistema

#### Operações para filas
- [ ] Envio de WhatsApp
- [ ] Notificações
- [ ] Audit logs
- [ ] Processamento de webhook

#### Endpoints com risco de duplicação
- [ ] POST /api/appointments
- [ ] POST /api/public/establishments/[slug]/book
- [ ] POST /api/subscriptions/trial
- [ ] POST /api/webhooks/mercadopago

#### Compatibilidade serverless Vercel
- [ ] Loops infinitos (while true)
- [ ] Workers residentes
- [ ] Conexões não gerenciadas
- [ ] Timeouts longos

---

## FASE 0.5: ÍNDICES DO BANCO

### Migration SQL

```sql
-- Índices para appointments (tabela mais crítica)
CREATE INDEX IF NOT EXISTS idx_appointments_establishment_date 
ON appointments ("establishmentId", date);

CREATE INDEX IF NOT EXISTS idx_appointments_professional_date 
ON appointments ("professionalId", date);

CREATE INDEX IF NOT EXISTS idx_appointments_client 
ON appointments ("clientId");

CREATE INDEX IF NOT EXISTS idx_appointments_status 
ON appointments (status);

CREATE INDEX IF NOT EXISTS idx_appointments_created 
ON appointments ("createdAt");

-- Índice composto para query de slots
CREATE INDEX IF NOT EXISTS idx_appointments_slots_query 
ON appointments ("professionalId", date, status, "startTime", "endTime");

-- Índices para subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
ON subscriptions ("userId", status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends 
ON subscriptions ("trialEndsAt") 
WHERE status = 'TRIALING';

-- Índices para clients
CREATE INDEX IF NOT EXISTS idx_clients_establishment 
ON clients ("establishmentId");

CREATE INDEX IF NOT EXISTS idx_clients_phone 
ON clients (phone);

-- Índices para services
CREATE INDEX IF NOT EXISTS idx_services_establishment 
ON services ("establishmentId");

-- Índices para professionals
CREATE INDEX IF NOT EXISTS idx_professionals_establishment 
ON professionals ("establishmentId");

-- Índices para trial_history
CREATE INDEX IF NOT EXISTS idx_trial_history_user 
ON trial_history ("userId");
```

### Checklist
- [ ] Criar migration com índices
- [ ] Testar em ambiente de staging
- [ ] Aplicar em produção
- [ ] Verificar plano de execução das queries

---

## FASE 0.7: POOLING DE CONEXÕES

### Problema
Serverless cria nova conexão a cada request. PostgreSQL tem limite de conexões.

### Opções (escolher UMA)

#### Opção A: Prisma Accelerate (Recomendado para Vercel)
```env
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
DIRECT_URL="postgresql://..." # Para migrations
```

#### Opção B: Neon Pooler
```env
DATABASE_URL="postgresql://...@ep-xxx.pooler.neon.tech/..."
```

#### Opção C: PgBouncer (Self-hosted)
```env
DATABASE_URL="postgresql://...@pgbouncer:6432/..."
```

### Checklist
- [ ] Escolher solução de pooling
- [ ] Configurar variáveis de ambiente
- [ ] Testar conexões sob carga
- [ ] Monitorar número de conexões ativas

---

## FASE 2: PROTEÇÃO CONTRA DUPLA RESERVA

### 2.1 Constraint Única no PostgreSQL (OBRIGATÓRIO)

**Esta é a última linha de defesa. Funciona mesmo se Redis cair ou código falhar.**

```sql
-- Impede duplicação exata de horário
CREATE UNIQUE INDEX IF NOT EXISTS unique_appointment_slot
ON appointments (
  "professionalId",
  date,
  "startTime"
)
WHERE status NOT IN ('CANCELLED');
```

**IMPORTANTE:** Esta constraint NÃO impede sobreposições parciais:
- 14:00-15:00 vs 14:30-15:30 (start_time diferente)
- O algoritmo de conflito no código é necessário para isso

### 2.2 Advisory Lock por Profissional + Data

**Chave do lock:** `professionalId + date` (NÃO inclui horário)

Motivo: Todos os horários do mesmo profissional no mesmo dia competem entre si.

```typescript
// lib/booking-lock.ts
import { prisma } from './prisma'

export async function withBookingLock<T>(
  professionalId: string,
  date: string,
  operation: () => Promise<T>
): Promise<T> {
  // Gerar hash numérico para o lock
  const lockKey = hashToNumber(`booking:${professionalId}:${date}`)
  
  return await prisma.$transaction(async (tx) => {
    // Adquirir lock exclusivo para este profissional neste dia
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`
    
    // Executar operação
    return await operation()
  })
}

function hashToNumber(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}
```

### 2.3 Idempotência Atômica para Booking

**Problema:** Check → Create → Set tem janela de race condition

**Solução:** Usar operação atômica

```typescript
// lib/idempotency.ts

// Para operações gerais (Redis)
export async function withIdempotency<T>(
  key: string,
  ttlSeconds: number,
  operation: () => Promise<T>
): Promise<{ result: T; wasIdempotent: boolean }> {
  const redis = getRedisClient()
  const idempotencyKey = `idempotency:${key}`
  
  // Tentar adquirir lock atômico
  const acquired = await redis.set(idempotencyKey, 'processing', {
    nx: true,  // Só seta se não existir
    ex: ttlSeconds
  })
  
  if (!acquired) {
    // Já existe, buscar resultado anterior
    const cached = await redis.get(`${idempotencyKey}:result`)
    if (cached) {
      return { result: JSON.parse(cached), wasIdempotent: true }
    }
    throw new Error('Operação já em processamento')
  }
  
  try {
    const result = await operation()
    
    // Salvar resultado
    await redis.set(`${idempotencyKey}:result`, JSON.stringify(result), {
      ex: ttlSeconds
    })
    
    return { result, wasIdempotent: false }
  } catch (error) {
    // Liberar lock em caso de erro
    await redis.del(idempotencyKey)
    throw error
  }
}
```

### 2.4 Idempotência Persistente para Pagamentos

**Para operações financeiras, usar banco (não Redis)**

```sql
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Limpar chaves antigas (rodar via cron)
-- DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '7 days';
```

```typescript
// lib/payment-idempotency.ts
export async function withPaymentIdempotency<T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  // Verificar se já processou
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key }
  })
  
  if (existing) {
    return existing.response as T
  }
  
  // Processar
  const result = await operation()
  
  // Salvar resultado (ignora se já existe - race condition)
  await prisma.idempotencyKey.upsert({
    where: { key },
    update: {},
    create: {
      key,
      response: result as any
    }
  })
  
  return result
}
```

### 2.5 Constraint para Mercado Pago

```sql
-- Impede webhook duplicado
ALTER TABLE webhook_events 
ADD CONSTRAINT unique_mp_event UNIQUE (event_id);

-- Impede assinatura duplicada por pagamento
ALTER TABLE subscriptions
ADD CONSTRAINT unique_payment_id UNIQUE (payment_id)
WHERE payment_id IS NOT NULL;
```

### Checklist Fase 2
- [ ] Criar migration com constraint única
- [ ] Implementar lib/booking-lock.ts
- [ ] Implementar lib/idempotency.ts
- [ ] Criar tabela idempotency_keys
- [ ] Atualizar POST /api/appointments
- [ ] Atualizar POST /api/public/establishments/[slug]/book
- [ ] Atualizar POST /api/webhooks/mercadopago
- [ ] Testar com requests simultâneos
- [ ] Verificar que constraint bloqueia duplicação

---

## FASE 1: SETUP UPSTASH REDIS

### Instalação
```bash
pnpm add @upstash/redis
```

### Configuração
```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis'

let redis: Redis | null = null

export function getRedisClient(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Redis não configurado')
    }
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

// Feature flag para rollback
export function isRedisEnabled(): boolean {
  return process.env.ENABLE_REDIS === 'true' &&
    !!process.env.UPSTASH_REDIS_REST_URL
}
```

### Variáveis de Ambiente
```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ENABLE_REDIS=true
```

### Checklist
- [ ] Criar conta Upstash
- [ ] Criar database Redis
- [ ] Adicionar variáveis no Vercel
- [ ] Testar conexão
- [ ] Implementar feature flag

---

## FASE 3: RATE LIMITING

### Implementação
```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { getRedisClient, isRedisEnabled } from './redis'

const limiters = new Map<string, Ratelimit>()

export function getRateLimiter(
  name: string,
  requests: number,
  window: string
): Ratelimit {
  const key = `${name}:${requests}:${window}`
  
  if (!limiters.has(key)) {
    limiters.set(key, new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `ratelimit:${name}`,
    }))
  }
  
  return limiters.get(key)!
}

export async function checkRateLimit(
  limiterName: string,
  identifier: string,
  requests: number,
  window: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (!isRedisEnabled()) {
    return { success: true, remaining: requests, reset: 0 }
  }
  
  const limiter = getRateLimiter(limiterName, requests, window)
  const result = await limiter.limit(identifier)
  
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  }
}
```

### Limites por Endpoint

| Endpoint | Limite | Janela | Identificador |
|----------|--------|--------|---------------|
| POST /api/auth/login | 5 | 1m | IP |
| POST /api/auth/register | 3 | 1h | IP |
| GET /api/appointments/slots | 30 | 1m | userId |
| POST /api/appointments | 10 | 1m | userId |
| POST /api/public/.../book | 5 | 1m | IP + phone |
| GET /api/public/... | 60 | 1m | IP |

### Checklist
- [ ] Implementar lib/rate-limit.ts
- [ ] Criar middleware de rate limit
- [ ] Aplicar em endpoints críticos
- [ ] Testar limites
- [ ] Adicionar headers X-RateLimit-*

---

## FASE 4: CACHE DE SLOTS

### Implementação com Stale-While-Revalidate

```typescript
// lib/slots-cache.ts
import { getRedisClient, isRedisEnabled } from './redis'

const CACHE_TTL = 30 // segundos
const STALE_TTL = 60 // segundos (serve stale enquanto revalida)
const LOCK_TTL = 5 // segundos

interface CachedSlots {
  data: Slot[]
  timestamp: number
}

export async function getCachedSlots(
  professionalId: string,
  date: string,
  revalidate: () => Promise<Slot[]>
): Promise<Slot[]> {
  if (!isRedisEnabled()) {
    return await revalidate()
  }
  
  const redis = getRedisClient()
  const cacheKey = `slots:${professionalId}:${date}`
  const lockKey = `${cacheKey}:lock`
  
  // Buscar cache
  const cached = await redis.get<CachedSlots>(cacheKey)
  const now = Date.now()
  
  if (cached) {
    const age = (now - cached.timestamp) / 1000
    
    // Cache fresco
    if (age < CACHE_TTL) {
      return cached.data
    }
    
    // Cache stale - retornar e revalidar em background
    if (age < STALE_TTL) {
      // Tentar adquirir lock para revalidação
      const acquired = await redis.set(lockKey, '1', { nx: true, ex: LOCK_TTL })
      
      if (acquired) {
        // Revalidar em background (não await)
        revalidateInBackground(cacheKey, lockKey, revalidate)
      }
      
      return cached.data
    }
  }
  
  // Cache expirado ou inexistente
  // Tentar adquirir lock para evitar stampede
  const acquired = await redis.set(lockKey, '1', { nx: true, ex: LOCK_TTL })
  
  if (!acquired && cached) {
    // Outro processo está revalidando, retornar stale
    return cached.data
  }
  
  // Revalidar
  try {
    const data = await revalidate()
    await redis.set(cacheKey, { data, timestamp: now }, { ex: STALE_TTL })
    return data
  } finally {
    await redis.del(lockKey)
  }
}

async function revalidateInBackground(
  cacheKey: string,
  lockKey: string,
  revalidate: () => Promise<Slot[]>
) {
  try {
    const data = await revalidate()
    const redis = getRedisClient()
    await redis.set(cacheKey, { data, timestamp: Date.now() }, { ex: STALE_TTL })
  } catch (error) {
    console.error('[SlotsCache] Erro na revalidação:', error)
  } finally {
    const redis = getRedisClient()
    await redis.del(lockKey)
  }
}

// Invalidar cache quando agendamento é criado/cancelado
export async function invalidateSlotsCache(
  professionalId: string,
  date: string
): Promise<void> {
  if (!isRedisEnabled()) return
  
  const redis = getRedisClient()
  await redis.del(`slots:${professionalId}:${date}`)
}
```

### Checklist
- [ ] Implementar lib/slots-cache.ts
- [ ] Integrar em GET /api/appointments/slots
- [ ] Integrar em GET /api/public/.../slots
- [ ] Invalidar cache ao criar agendamento
- [ ] Invalidar cache ao cancelar agendamento
- [ ] Testar proteção contra stampede

---

## FASE 4.5: OBSERVABILIDADE

### Métricas para Coletar

```typescript
// lib/metrics.ts
import { getRedisClient, isRedisEnabled } from './redis'

type MetricType = 
  | 'slots_cache_hit'
  | 'slots_cache_miss'
  | 'slots_cache_stale'
  | 'booking_success'
  | 'booking_failure'
  | 'booking_duplicate_blocked'
  | 'whatsapp_success'
  | 'whatsapp_failure'
  | 'webhook_received'
  | 'webhook_duplicate'
  | 'rate_limit_exceeded'

export async function trackMetric(
  metric: MetricType,
  value: number = 1,
  tags?: Record<string, string>
): Promise<void> {
  if (!isRedisEnabled()) return
  
  const redis = getRedisClient()
  const today = new Date().toISOString().split('T')[0]
  const key = `metrics:${today}:${metric}`
  
  await redis.incrby(key, value)
  await redis.expire(key, 86400 * 7) // 7 dias
  
  // Tags opcionais
  if (tags) {
    for (const [tagKey, tagValue] of Object.entries(tags)) {
      const taggedKey = `${key}:${tagKey}:${tagValue}`
      await redis.incrby(taggedKey, value)
      await redis.expire(taggedKey, 86400 * 7)
    }
  }
}

export async function trackDuration(
  operation: string,
  durationMs: number
): Promise<void> {
  if (!isRedisEnabled()) return
  
  const redis = getRedisClient()
  const today = new Date().toISOString().split('T')[0]
  
  // Armazenar para calcular média depois
  await redis.lpush(`duration:${today}:${operation}`, durationMs)
  await redis.ltrim(`duration:${today}:${operation}`, 0, 999) // Últimas 1000
  await redis.expire(`duration:${today}:${operation}`, 86400 * 7)
}
```

### Dashboard de Métricas (Admin)

Endpoint: GET /api/admin/metrics

```typescript
// Retorna:
{
  today: {
    slots_cache_hit: 1234,
    slots_cache_miss: 56,
    cache_hit_ratio: 0.96,
    booking_success: 89,
    booking_failure: 2,
    whatsapp_success: 150,
    whatsapp_failure: 3,
    avg_booking_duration_ms: 234
  },
  last7days: { ... }
}
```

### Sentry para Erros

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs'

export function captureBookingError(error: Error, context: {
  userId?: string
  professionalId?: string
  date?: string
  startTime?: string
}) {
  Sentry.captureException(error, {
    tags: {
      feature: 'booking',
      ...context
    }
  })
}
```

### Checklist
- [ ] Implementar lib/metrics.ts
- [ ] Integrar trackMetric em operações críticas
- [ ] Criar endpoint GET /api/admin/metrics
- [ ] Adicionar página de métricas no admin
- [ ] Configurar Sentry (opcional)
- [ ] Definir alertas para taxa de erro > 5%

---

## FASE 5: FILAS COM QSTASH

### Instalação
```bash
pnpm add @upstash/qstash
```

### Configuração
```typescript
// lib/queue.ts
import { Client } from '@upstash/qstash'

let qstash: Client | null = null

export function getQStashClient(): Client {
  if (!qstash) {
    if (!process.env.QSTASH_TOKEN) {
      throw new Error('QStash não configurado')
    }
    qstash = new Client({
      token: process.env.QSTASH_TOKEN,
    })
  }
  return qstash
}

export function isQueueEnabled(): boolean {
  return process.env.ENABLE_QUEUE === 'true' &&
    !!process.env.QSTASH_TOKEN
}
```

### Publicar na Fila
```typescript
// lib/queue-publisher.ts
import { getQStashClient, isQueueEnabled } from './queue'

export async function enqueueWhatsApp(payload: {
  phone: string
  message: string
  establishmentId: string
}): Promise<void> {
  if (!isQueueEnabled()) {
    // Fallback: enviar diretamente
    await sendWhatsAppDirect(payload)
    return
  }
  
  const qstash = getQStashClient()
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_API_URL}/api/workers/whatsapp`,
    body: payload,
    retries: 3,
  })
}

export async function enqueueNotification(payload: {
  type: string
  userId: string
  data: any
}): Promise<void> {
  if (!isQueueEnabled()) {
    await createNotificationDirect(payload)
    return
  }
  
  const qstash = getQStashClient()
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_API_URL}/api/workers/notification`,
    body: payload,
    retries: 3,
  })
}
```

### Workers
```typescript
// app/api/workers/whatsapp/route.ts
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'

async function handler(request: Request) {
  const body = await request.json()
  
  // Processar envio de WhatsApp
  await sendWhatsAppMessage(body.phone, body.message, body.establishmentId)
  
  return Response.json({ success: true })
}

export const POST = verifySignatureAppRouter(handler)
```

### Webhook Mercado Pago com Persistência

```typescript
// app/api/webhooks/mercadopago/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  
  // 1. Persistir evento ANTES de tudo
  const eventId = body.id || body.data?.id
  
  try {
    await prisma.webhookEvent.create({
      data: {
        eventId,
        type: body.type,
        payload: body,
        status: 'RECEIVED',
      }
    })
  } catch (error) {
    // Evento duplicado (constraint única)
    return Response.json({ received: true })
  }
  
  // 2. Responder 200 OK imediatamente
  // 3. Processar via fila
  if (isQueueEnabled()) {
    await getQStashClient().publishJSON({
      url: `${process.env.NEXT_PUBLIC_API_URL}/api/workers/mercadopago`,
      body: { eventId },
    })
  } else {
    // Processar diretamente
    await processWebhookEvent(eventId)
  }
  
  return Response.json({ received: true })
}
```

### Checklist
- [ ] Criar conta Upstash QStash
- [ ] Adicionar QSTASH_TOKEN e QSTASH_CURRENT_SIGNING_KEY
- [ ] Implementar lib/queue.ts
- [ ] Implementar lib/queue-publisher.ts
- [ ] Criar app/api/workers/whatsapp/route.ts
- [ ] Criar app/api/workers/notification/route.ts
- [ ] Criar app/api/workers/mercadopago/route.ts
- [ ] Migrar envios de WhatsApp para fila
- [ ] Migrar notificações para fila
- [ ] Atualizar webhook Mercado Pago

---

## FASE 6: CACHE ESTÁTICO

### Cache de Planos
```typescript
// TTL: 5 minutos
// Invalidar: ao criar/editar/excluir plano

const PLANS_CACHE_KEY = 'plans:active'
const PLANS_TTL = 300

export async function getCachedPlans(): Promise<Plan[]> {
  if (!isRedisEnabled()) {
    return await prisma.plan.findMany({ where: { active: true } })
  }
  
  const redis = getRedisClient()
  const cached = await redis.get<Plan[]>(PLANS_CACHE_KEY)
  
  if (cached) return cached
  
  const plans = await prisma.plan.findMany({ where: { active: true } })
  await redis.set(PLANS_CACHE_KEY, plans, { ex: PLANS_TTL })
  
  return plans
}

export async function invalidatePlansCache(): Promise<void> {
  if (!isRedisEnabled()) return
  await getRedisClient().del(PLANS_CACHE_KEY)
}
```

### Cache de Estabelecimento
```typescript
// TTL: 2 minutos
// Invalidar: ao editar estabelecimento, serviços ou profissionais

const ESTABLISHMENT_TTL = 120

export async function getCachedEstablishment(slug: string) {
  if (!isRedisEnabled()) {
    return await fetchEstablishmentFromDB(slug)
  }
  
  const redis = getRedisClient()
  const cacheKey = `establishment:${slug}`
  const cached = await redis.get(cacheKey)
  
  if (cached) return cached
  
  const data = await fetchEstablishmentFromDB(slug)
  await redis.set(cacheKey, data, { ex: ESTABLISHMENT_TTL })
  
  return data
}

// Invalidar em:
// - PUT /api/establishments/[id]
// - POST/PUT/DELETE /api/services
// - POST/PUT/DELETE /api/professionals
export async function invalidateEstablishmentCache(slug: string): Promise<void> {
  if (!isRedisEnabled()) return
  await getRedisClient().del(`establishment:${slug}`)
}
```

### Checklist
- [ ] Implementar cache de planos
- [ ] Implementar cache de estabelecimento
- [ ] Adicionar invalidação nos endpoints de edição
- [ ] Testar invalidação automática

---

## VARIÁVEIS DE AMBIENTE

```env
# Redis (Fase 1)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ENABLE_REDIS=true

# QStash (Fase 5)
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
ENABLE_QUEUE=true

# Feature Flags
ENABLE_SLOTS_CACHE=true
ENABLE_RATE_LIMIT=true
ENABLE_BOOKING_LOCK=true
```

---

## ROLLBACK POR FEATURE FLAG

Cada funcionalidade pode ser desabilitada independentemente:

```typescript
// Exemplo de uso
if (process.env.ENABLE_SLOTS_CACHE === 'true' && isRedisEnabled()) {
  return await getCachedSlots(professionalId, date, revalidate)
} else {
  return await revalidate()
}
```

---

## CRONOGRAMA SUGERIDO

### Semana 1 (CRÍTICO)
- [ ] FASE 0: Auditoria completa
- [ ] FASE 0.5: Criar e aplicar índices
- [ ] FASE 0.7: Configurar pooling

### Semana 2 (CRÍTICO)
- [ ] FASE 2: Implementar proteção contra dupla reserva
- [ ] Testar extensivamente com requests simultâneos

### Semana 3-4 (Quando necessário)
- [ ] FASE 1: Setup Redis
- [ ] FASE 3: Rate limiting
- [ ] FASE 4: Cache de slots

### Futuro (Baseado em métricas)
- [ ] FASE 4.5: Observabilidade
- [ ] FASE 5: Filas
- [ ] FASE 6: Cache estático

---

## NOTAS IMPORTANTES

1. **Constraint única é obrigatória** - É a última linha de defesa contra duplicação
2. **Advisory Lock por profissional+data** - Não por horário específico
3. **Não use while(true)** - Não funciona na Vercel serverless
4. **Persista webhooks antes de responder** - Evita perda de eventos
5. **Meça antes de otimizar** - A auditoria pode revelar que o gargalo está em outro lugar
6. **Pooling é crítico** - Sem ele, você vai bater limite de conexões rapidamente
