/**
 * Booking Lock - Proteção contra dupla reserva
 * 
 * Usa PostgreSQL Advisory Lock para garantir que apenas um processo
 * pode criar agendamento para um profissional em um dia específico.
 * 
 * IMPORTANTE: O lock é por profissional + data, não por horário.
 * Isso garante que todos os horários do mesmo dia competem pelo mesmo lock.
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { randomBytes } from 'crypto'
import { invalidateSlotsCache } from './redis'

// Gera um token unico e aleatorio para o link publico de confirmacao
export function generateConfirmationToken(): string {
  return randomBytes(24).toString('hex')
}

// Gera hash numérico para usar como chave do advisory lock
function hashToNumber(str: string): bigint {
  let hash = BigInt(0)
  for (let i = 0; i < str.length; i++) {
    const char = BigInt(str.charCodeAt(i))
    hash = ((hash << BigInt(5)) - hash) + char
    hash = hash & BigInt(0x7FFFFFFFFFFFFFFF) // Mantém positivo
  }
  return hash
}

/**
 * Executa uma operação de agendamento com lock exclusivo
 * 
 * @param prisma - Cliente Prisma
 * @param professionalId - ID do profissional
 * @param date - Data do agendamento (YYYY-MM-DD)
 * @param operation - Função a ser executada dentro da transação
 * @returns Resultado da operação
 */
export async function withBookingLock<T>(
  prisma: PrismaClient,
  professionalId: string,
  date: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  // Gerar chave única para o lock
  const lockKey = hashToNumber(`booking:${professionalId}:${date}`)
  
  // Usar transação com advisory lock
  return await prisma.$transaction(async (tx) => {
    // Adquirir lock exclusivo para este profissional neste dia
    // pg_advisory_xact_lock é liberado automaticamente no fim da transação
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`
    
    // Executar operação com lock ativo
    return await operation(tx)
  }, {
    maxWait: 5000, // Esperar no máximo 5s para iniciar transação
    timeout: 10000, // Timeout total de 10s
  })
}

/**
 * Verifica conflito de horário dentro de uma transação
 * 
 * @param tx - Cliente de transação Prisma
 * @param professionalId - ID do profissional
 * @param date - Data do agendamento
 * @param startTime - Horário de início (HH:MM)
 * @param endTime - Horário de término (HH:MM)
 * @param excludeAppointmentId - ID de agendamento a excluir (para edição)
 * @returns true se há conflito, false caso contrário
 */
export async function checkConflict(
  tx: Prisma.TransactionClient,
  professionalId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string
): Promise<boolean> {
  const startTimeDate = new Date(`1970-01-01T${startTime}:00`)
  const endTimeDate = new Date(`1970-01-01T${endTime}:00`)
  
  const whereClause: Prisma.AppointmentWhereInput = {
    professionalId,
    date,
    status: { notIn: ['CANCELLED'] },
    OR: [
      // Novo começa durante existente
      {
        AND: [
          { startTime: { lte: startTimeDate } },
          { endTime: { gt: startTimeDate } },
        ],
      },
      // Novo termina durante existente
      {
        AND: [
          { startTime: { lt: endTimeDate } },
          { endTime: { gte: endTimeDate } },
        ],
      },
      // Novo contém existente
      {
        AND: [
          { startTime: { gte: startTimeDate } },
          { endTime: { lte: endTimeDate } },
        ],
      },
    ],
  }
  
  // Excluir agendamento específico (para edição)
  if (excludeAppointmentId) {
    whereClause.id = { not: excludeAppointmentId }
  }
  
  const conflicting = await tx.appointment.findFirst({
    where: whereClause,
    select: { id: true },
  })
  
  return !!conflicting
}

/**
 * Cria agendamento com proteção contra dupla reserva
 * 
 * Combina:
 * 1. Advisory Lock por profissional + data
 * 2. Verificação de conflito dentro da transação
 * 3. Constraint única no banco (fallback)
 */
export async function createAppointmentSafe(
  prisma: PrismaClient,
  data: {
    date: string
    startTime: string
    endTime: string
    price: number | Prisma.Decimal
    notes?: string
    establishmentId: string
    professionalId: string
    serviceId: string
    clientId: string
  }
): Promise<{ success: true; appointment: unknown } | { success: false; error: string }> {
  try {
    const appointment = await withBookingLock(
      prisma,
      data.professionalId,
      data.date,
      async (tx) => {
        // Verificar conflito com lock ativo
        const hasConflict = await checkConflict(
          tx,
          data.professionalId,
          new Date(data.date),
          data.startTime,
          data.endTime
        )
        
        if (hasConflict) {
          throw new Error('CONFLICT')
        }
        
        // Criar agendamento
        return await tx.appointment.create({
          data: {
            date: new Date(data.date),
            startTime: new Date(`1970-01-01T${data.startTime}:00`),
            endTime: new Date(`1970-01-01T${data.endTime}:00`),
            price: data.price,
            notes: data.notes,
            establishmentId: data.establishmentId,
            professionalId: data.professionalId,
            serviceId: data.serviceId,
            clientId: data.clientId,
            // Token unico para o link publico de confirmacao
            confirmationToken: generateConfirmationToken(),
          },
          include: {
            client: true,
            professional: true,
            service: true,
          },
        })
      }
    )
    
    // Invalida cache de slots (nao bloqueia)
    invalidateSlotsCache(data.establishmentId, data.professionalId, data.date).catch((err) => {
      console.error('[Cache] Erro ao invalidar cache apos criar agendamento:', err)
    })
    
    return { success: true, appointment }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'CONFLICT') {
        return { success: false, error: 'Horário não disponível - conflito com outro agendamento' }
      }
      
      // Constraint única violada (fallback de segurança)
      if (error.message.includes('unique_appointment_slot') || 
          error.message.includes('Unique constraint')) {
        return { success: false, error: 'Horário não disponível - já existe agendamento' }
      }
    }
    
    throw error
  }
}
