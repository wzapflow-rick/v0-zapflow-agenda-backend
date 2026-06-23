# Sistema de Especialização por Nicho (BusinessType)

Camada de configuração por nicho (barbearia, personal, salão, clínica, outro) que altera terminologia, serviços padrão, templates de WhatsApp e cards do dashboard — e habilita módulos exclusivos por segmento no futuro. Não altera o core de agendamento e é 100% retrocompatível.

## Conceitos

- **Nichos são estáticos**: vivem em arquivos TS em `config/business-types/`. Não há tabela no banco.
- **`businessType`** é uma coluna em `Establishment` (enum, default `OTHER`).
- **`metadata`** (`Json?`) guarda configs específicas por nicho sem criar colunas novas (ex.: `{ "chairCount": 4 }`, `{ "crmRequired": true }`).

## Estrutura da configuração

Cada nicho implementa `BusinessConfiguration`, que separa a camada visual (`ui`) da de negócio (`business`):

```ts
interface BusinessConfiguration {
  id: BusinessType;
  label: string;
  ui: {
    labels: { client; professional; appointment; service; dashboardTitle };
    dashboardCards: { id: string; enabled: boolean; order: number }[];
  };
  business: {
    defaultServices: { name: string; duration: number }[];
    features: string[]; // ex.: ["products"], ["memberships","workouts"]
  };
  whatsappTemplates: Record<string, string>;
}
```

### Features (módulos)

`features` é um **array de strings** (não objeto de booleans) para escalar a dezenas de módulos sem breaking change. As chaves conhecidas ficam em `FEATURES`:

```ts
import { FEATURES, hasFeature } from '@/config/business-types';

if (hasFeature(config, FEATURES.WORKOUTS)) {
  // lógica exclusiva de personal trainer
}
```

## Como adicionar um novo nicho

1. Adicione o valor no enum `BusinessType` em `prisma/schema.prisma`.
2. Crie `config/business-types/<nicho>.ts` implementando `BusinessConfiguration`.
3. Registre no objeto `REGISTRY` em `config/business-types/index.ts`.
4. Adicione casos no teste `registry.test.ts`.

## Resolver e helper global

- `resolveBusinessConfig(type)` — **função pura** (sem DB, sem cache). Fallback para `OTHER`.
- `getCurrentBusinessConfig(establishmentId)` — consulta o `businessType` + `metadata` **direto no banco** e resolve a config.

> **Serverless:** NÃO há cache local em memória (Map). Na Vercel cada instância tem memória própria, e um cache local geraria inconsistência entre instâncias. Quando a camada Redis estiver pronta, `getCurrentBusinessConfig` é o ponto para um cache distribuído com TTL.

## Onboarding e seed de serviços

- `POST /api/auth/register` aceita `businessType` (opcional, default `OTHER`).
- Logo após criar o estabelecimento, `seedDefaultServices` cria os serviços padrão do nicho **apenas se** `businessType != OTHER` e **se** ainda não existirem serviços. Os serviços nascem com `price = 0` (o dono ajusta depois). Falha no seed nunca quebra o registro.
- `PUT /api/establishments` aceita `businessType` e `metadata`. Não re-seeda (evita duplicar serviços).

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/business-types` | Lista `[{ id, label }]` de todos os nichos |
| GET | `/api/business-types/[type]` | Config pública completa do nicho (404 se inválido) |

## Retrocompatibilidade

Campos opcionais + default `OTHER` + `metadata` null. Estabelecimentos existentes continuam funcionando como `OTHER`, com labels genéricos e sem módulos exclusivos. Nenhum endpoint existente muda de comportamento.
