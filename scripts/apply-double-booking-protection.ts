import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyDoubleBookingProtection() {
  console.log('Aplicando proteção contra dupla reserva...\n')

  const migrations = [
    // Constraint única para agendamentos
    {
      name: 'unique_appointment_slot',
      sql: `
        CREATE UNIQUE INDEX IF NOT EXISTS unique_appointment_slot
        ON appointments (
          "professionalId",
          date,
          "startTime"
        )
        WHERE status NOT IN ('CANCELLED')
      `,
    },
    // Tabela de idempotência
    {
      name: 'idempotency_keys_table',
      sql: `
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          key TEXT PRIMARY KEY,
          response JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `,
    },
    {
      name: 'idx_idempotency_keys_created',
      sql: `CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys (created_at)`,
    },
    // Tabela de eventos de webhook
    {
      name: 'webhook_events_table',
      sql: `
        CREATE TABLE IF NOT EXISTS webhook_events (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          event_id TEXT UNIQUE NOT NULL,
          event_type TEXT NOT NULL,
          payload JSONB NOT NULL,
          status TEXT DEFAULT 'RECEIVED',
          processed_at TIMESTAMP,
          error TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `,
    },
    {
      name: 'idx_webhook_events_status',
      sql: `CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events (status, created_at)`,
    },
  ]

  let success = 0
  let failed = 0

  for (const migration of migrations) {
    try {
      await prisma.$executeRawUnsafe(migration.sql)
      console.log(`✓ ${migration.name}`)
      success++
    } catch (error) {
      console.error(`✗ ${migration.name}: ${error instanceof Error ? error.message : 'Erro'}`)
      failed++
    }
  }

  console.log(`\nResultado: ${success} sucesso, ${failed} falhas`)

  // Verificar se a constraint foi criada
  const constraints = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname 
    FROM pg_indexes 
    WHERE indexname = 'unique_appointment_slot'
  `

  if (constraints.length > 0) {
    console.log('\n✓ Constraint única de agendamento está ativa')
  } else {
    console.log('\n✗ ALERTA: Constraint única NÃO foi criada!')
  }

  // Verificar tabelas
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('idempotency_keys', 'webhook_events')
  `

  console.log(`\nTabelas criadas: ${tables.map(t => t.tablename).join(', ')}`)
}

applyDoubleBookingProtection()
  .catch((error) => {
    console.error('Erro:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
