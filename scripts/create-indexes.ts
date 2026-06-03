import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createIndexes() {
  console.log('Criando índices de performance...\n')

  const indexes = [
    // Appointments
    {
      name: 'idx_appointments_client',
      sql: `CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments ("clientId")`,
    },
    {
      name: 'idx_appointments_status',
      sql: `CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status)`,
    },
    {
      name: 'idx_appointments_slots_query',
      sql: `CREATE INDEX IF NOT EXISTS idx_appointments_slots_query ON appointments ("professionalId", date, status, "startTime", "endTime")`,
    },
    {
      name: 'idx_appointments_created',
      sql: `CREATE INDEX IF NOT EXISTS idx_appointments_created ON appointments ("createdAt" DESC)`,
    },

    // Subscriptions
    {
      name: 'idx_subscriptions_trial_ends',
      sql: `CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends ON subscriptions ("trialEndsAt") WHERE status = 'TRIALING'`,
    },
    {
      name: 'idx_subscriptions_status',
      sql: `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status)`,
    },

    // Clients
    {
      name: 'idx_clients_establishment',
      sql: `CREATE INDEX IF NOT EXISTS idx_clients_establishment ON clients ("establishmentId")`,
    },
    {
      name: 'idx_clients_phone',
      sql: `CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone)`,
    },

    // Services
    {
      name: 'idx_services_establishment',
      sql: `CREATE INDEX IF NOT EXISTS idx_services_establishment ON services ("establishmentId")`,
    },

    // Professionals
    {
      name: 'idx_professionals_establishment',
      sql: `CREATE INDEX IF NOT EXISTS idx_professionals_establishment ON professionals ("establishmentId")`,
    },

    // Notifications
    {
      name: 'idx_notifications_unread',
      sql: `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications ("establishmentId", read, "createdAt" DESC)`,
    },

    // Message Logs
    {
      name: 'idx_message_logs_appointment',
      sql: `CREATE INDEX IF NOT EXISTS idx_message_logs_appointment ON message_logs ("appointmentId")`,
    },

    // Audit Logs
    {
      name: 'idx_audit_logs_resource',
      sql: `CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs ("resourceType", "resourceId")`,
    },
  ]

  let created = 0
  let failed = 0

  for (const index of indexes) {
    try {
      await prisma.$executeRawUnsafe(index.sql)
      console.log(`✓ ${index.name}`)
      created++
    } catch (error) {
      console.error(`✗ ${index.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      failed++
    }
  }

  console.log(`\nResultado: ${created} criados, ${failed} falharam`)

  // Verificar índices existentes
  const existingIndexes = await prisma.$queryRaw<{ indexname: string; tablename: string }[]>`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `

  console.log('\nÍndices existentes:')
  for (const idx of existingIndexes) {
    console.log(`  ${idx.tablename}.${idx.indexname}`)
  }
}

createIndexes()
  .catch((error) => {
    console.error('Erro:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
