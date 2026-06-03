# RELATÓRIO DE AUDITORIA TÉCNICA - ZapAgenda Backend

> **Data:** Junho 2026
> **Status:** FASE 0 COMPLETA

---

## RESUMO EXECUTIVO

### Problemas Críticos Encontrados: 5
### Problemas Altos: 8
### Problemas Médios: 6
### Melhorias Sugeridas: 4

---

## 1. RACE CONDITIONS (CRÍTICO)

### 1.1 Dupla Reserva de Agendamento

**Arquivos afetados:**
- `app/api/appointments/route.ts` (linha 106-141)
- `app/api/public/establishments/[slug]/book/route.ts` (linha 68-103)

**Problema:**
```typescript
// PROBLEMA: Verificação e criação NÃO são atômicas
const conflictingAppointment = await prisma.appointment.findFirst({...})

if (conflictingAppointment) {
  throw new ApiError('Horário não disponível', 409);
}

// JANELA DE RACE CONDITION AQUI
// Outro request pode passar pela verificação antes deste criar

const appointment = await prisma.appointment.create({...})
```

**Cenário de falha:**
```
Request A: verifica → vazio
Request B: verifica → vazio
Request A: cria agendamento 14:00
Request B: cria agendamento 14:00 (DUPLICADO!)
```

**Impacto:** Alto - Dois clientes podem agendar o mesmo horário

**Solução:** 
1. Constraint única no banco (última linha de defesa)
2. Advisory Lock por profissional + data

---

### 1.2 Trial Duplicado

**Arquivo:** `app/api/subscriptions/trial/route.ts`

**Problema:** Verificação de trial_history e criação não são atômicas (já corrigido parcialmente com $transaction)

**Status:** Parcialmente mitigado com transação

---

### 1.3 Webhook Mercado Pago Duplicado

**Arquivo:** `app/api/webhooks/mercadopago/route.ts`

**Problema:**
```typescript
// PROBLEMA: Não verifica se já processou este evento
const { type, data } = body;

if (type === 'payment') {
  // Processa diretamente sem verificar duplicação
  await prisma.subscription.upsert({...})
}
```

**Cenário de falha:**
- Mercado Pago reenvia webhook (timeout, retry)
- Assinatura é processada múltiplas vezes

**Solução:**
1. Persistir evento antes de processar
2. Constraint única em event_id
3. Verificar idempotência

---

## 2. ÍNDICES FALTANDO (CRÍTICO)

### Schema atual do Prisma:
```prisma
// appointments - TEM índices básicos
@@index([establishmentId, date])
@@index([professionalId, date])

// FALTAM:
// - Índice para query de slots (composto)
// - Índice para status
// - Índice para clientId
```

### Queries sem índices adequados:

| Query | Arquivo | Índice Necessário |
|-------|---------|-------------------|
| `findMany({ where: { clientId } })` | appointments/route.ts | `(clientId)` |
| `findMany({ where: { status } })` | appointments/route.ts | `(status)` |
| `findFirst({ where: { professionalId, date, status } })` | book/route.ts | `(professionalId, date, status)` |

### Índices a criar:
```sql
CREATE INDEX idx_appointments_client ON appointments ("clientId");
CREATE INDEX idx_appointments_status ON appointments (status);
CREATE INDEX idx_appointments_slots ON appointments ("professionalId", date, status, "startTime", "endTime");
CREATE INDEX idx_clients_establishment ON clients ("establishmentId");
CREATE INDEX idx_clients_phone ON clients (phone);
CREATE INDEX idx_services_establishment ON services ("establishmentId");
CREATE INDEX idx_professionals_establishment ON professionals ("establishmentId");
```

---

## 3. CONSULTAS N+1

### 3.1 Listagem de Agendamentos

**Arquivo:** `app/api/appointments/route.ts`

**Código atual:**
```typescript
prisma.appointment.findMany({
  where,
  include: {
    client: true,         // JOIN 1
    professional: true,   // JOIN 2
    service: true,        // JOIN 3
  },
})
```

**Status:** OK - Usando include (JOINs)

### 3.2 Cron de Lembretes

**Arquivo:** `app/api/cron/reminders/route.ts`

**Problema potencial:** Busca appointments e depois itera enviando mensagens

**Status:** Aceitável - WhatsApp é I/O bound, não CPU

---

## 4. OPERAÇÕES PARA CACHE

| Operação | Arquivo | Frequência | TTL Sugerido |
|----------|---------|------------|--------------|
| Cálculo de slots | slots/route.ts | Alta | 30s |
| Dados do estabelecimento | public/[slug]/route.ts | Alta | 2min |
| Lista de planos | plans/route.ts | Média | 5min |
| Configurações de mensagem | automatic-messages/route.ts | Baixa | 5min |

---

## 5. OPERAÇÕES PARA FILAS

| Operação | Arquivo | Motivo |
|----------|---------|--------|
| Envio WhatsApp | lib/whatsapp.ts | Timeout externo, retry |
| Notificações | lib/notifications.ts | Não crítico, pode atrasar |
| Audit logs | lib/audit-log.ts | Não crítico |
| Webhook MP | webhooks/mercadopago/route.ts | Garantir entrega |

---

## 6. ENDPOINTS COM RISCO DE DUPLICAÇÃO

### 6.1 POST /api/appointments (CRÍTICO)
- **Risco:** Dupla reserva
- **Solução:** Constraint + Lock

### 6.2 POST /api/public/establishments/[slug]/book (CRÍTICO)
- **Risco:** Dupla reserva + cliente duplicado
- **Solução:** Constraint + Lock + Idempotência

### 6.3 POST /api/subscriptions/trial (ALTO)
- **Risco:** Trial duplicado
- **Solução:** Já usa transação, adicionar idempotência

### 6.4 POST /api/webhooks/mercadopago (ALTO)
- **Risco:** Processamento duplicado
- **Solução:** Persistir evento + constraint única

### 6.5 POST /api/clients (MÉDIO)
- **Risco:** Cliente duplicado
- **Solução:** Já tem constraint única (phone + establishmentId)

---

## 7. COMPATIBILIDADE SERVERLESS VERCEL

### 7.1 Rate Limit Atual

**Arquivo:** `lib/rate-limit.ts`

**Problema:**
```typescript
// PROBLEMA: Usa Map em memória
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
```

**Por que não funciona:**
- Vercel cria nova instância a cada request
- Map é resetado
- Rate limit não funciona

**Solução:** Upstash Redis

### 7.2 Conexões de Banco

**Status:** Sem pooling configurado

**Problema:** Serverless pode esgotar conexões do PostgreSQL

**Solução:** Prisma Accelerate ou Neon Pooler

---

## 8. ESTIMATIVA DE GARGALOS POR ESCALA

### 1.000 usuários simultâneos
- **Gargalo provável:** Conexões PostgreSQL
- **Solução:** Pooling

### 5.000 usuários simultâneos
- **Gargalo provável:** Query de slots (recalculada a cada request)
- **Solução:** Cache Redis

### 10.000 usuários simultâneos
- **Gargalo provável:** Rate limit + WhatsApp timeout
- **Solução:** Rate limit Redis + Filas QStash

---

## 9. PROBLEMAS ESPECÍFICOS ENCONTRADOS

### 9.1 Booking Público sem Idempotência

**Arquivo:** `app/api/public/establishments/[slug]/book/route.ts`

```typescript
// PROBLEMA: Se o cliente clicar 2x ou a internet oscilar
// pode criar 2 agendamentos
export async function POST(request: NextRequest, ...) {
  // Não verifica idempotency_key
  const appointment = await prisma.appointment.create({...})
}
```

**Solução:**
```typescript
// Frontend envia: { idempotencyKey: uuid() }
const existing = await checkIdempotency(body.idempotencyKey)
if (existing) return success(existing)
```

### 9.2 Webhook não persiste evento

**Arquivo:** `app/api/webhooks/mercadopago/route.ts`

```typescript
// PROBLEMA: Se der erro no meio, perde o evento
if (type === 'payment') {
  const payment = await getPayment(paymentId) // Pode falhar
  await prisma.subscription.upsert({...}) // Pode falhar
}
return NextResponse.json({ received: true }) // Já respondeu 200
```

**Solução:**
```typescript
// 1. Persistir evento
await prisma.webhookEvent.create({ data: { eventId, payload: body } })

// 2. Responder 200
// 3. Processar depois (ou via fila)
```

### 9.3 Slots sem proteção contra cache stampede

**Arquivo:** `app/api/appointments/slots/route.ts`

```typescript
// PROBLEMA: Sem cache, recalcula a cada request
// Se 100 usuários pedirem slots do mesmo profissional/dia
// = 100 queries no banco
```

**Solução:** Cache com lock de revalidação

---

## 10. CHECKLIST DE AÇÕES

### FASE 0.5 - Índices (CRÍTICO)
- [ ] Criar migration com índices
- [ ] Testar plano de execução
- [ ] Aplicar em produção

### FASE 0.7 - Pooling (CRÍTICO)
- [ ] Configurar Prisma Accelerate ou Neon Pooler
- [ ] Testar sob carga

### FASE 2 - Dupla Reserva (CRÍTICO)
- [ ] Criar constraint única em appointments
- [ ] Implementar Advisory Lock
- [ ] Implementar idempotência no booking público
- [ ] Persistir webhook antes de processar

### FASE 1 - Redis (ALTO)
- [ ] Configurar Upstash Redis
- [ ] Migrar rate limit para Redis

### FASE 3 - Rate Limit (MÉDIO)
- [ ] Implementar rate limit com Redis

### FASE 4 - Cache (MÉDIO)
- [ ] Cache de slots
- [ ] Cache de estabelecimento

### FASE 5 - Filas (BAIXO)
- [ ] QStash para WhatsApp
- [ ] QStash para notificações

---

## CONCLUSÃO

O sistema está funcional para MVP e primeiros clientes, mas possui **5 problemas críticos** que precisam ser resolvidos antes de escalar:

1. **Race condition em agendamentos** - pode causar dupla reserva
2. **Webhook sem idempotência** - pode processar pagamento 2x
3. **Índices faltando** - queries vão ficar lentas
4. **Rate limit em memória** - não funciona na Vercel
5. **Sem pooling** - vai esgotar conexões

**Recomendação:** Implementar FASE 0.5, 0.7 e 2 antes de qualquer crescimento significativo de usuários.
