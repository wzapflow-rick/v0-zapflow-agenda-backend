/**
 * Idempotência - Proteção contra operações duplicadas
 * 
 * Garante que a mesma operação não seja executada múltiplas vezes,
 * mesmo se o cliente enviar a requisição duplicada.
 */

import prisma from './prisma'

/**
 * Executa operação com idempotência baseada em banco de dados
 * Use para operações críticas como pagamentos
 * 
 * @param key - Chave única da operação
 * @param operation - Função a ser executada
 * @returns Resultado da operação (novo ou cached)
 */
export async function withPaymentIdempotency<T>(
  key: string,
  operation: () => Promise<T>
): Promise<{ result: T; wasIdempotent: boolean }> {
  // Verificar se já processou
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key },
  })
  
  if (existing && existing.response) {
    return { 
      result: existing.response as T, 
      wasIdempotent: true 
    }
  }
  
  // Executar operação
  const result = await operation()
  
  // Salvar resultado (upsert para lidar com race condition)
  await prisma.idempotencyKey.upsert({
    where: { key },
    update: { response: result as object },
    create: {
      key,
      response: result as object,
    },
  })
  
  return { result, wasIdempotent: false }
}

/**
 * Gera chave de idempotência para booking público
 * 
 * @param establishmentId - ID do estabelecimento
 * @param clientPhone - Telefone do cliente
 * @param date - Data do agendamento
 * @param startTime - Horário de início
 * @returns Chave de idempotência
 */
export function generateBookingIdempotencyKey(
  establishmentId: string,
  clientPhone: string,
  date: string,
  startTime: string
): string {
  return `booking:${establishmentId}:${clientPhone}:${date}:${startTime}`
}

/**
 * Verifica idempotência de booking (sem persistir)
 * Usa a constraint única do banco como proteção
 * 
 * @param key - Chave de idempotência
 * @returns Resultado cached ou null
 */
export async function checkBookingIdempotency(
  key: string
): Promise<object | null> {
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key },
  })
  
  return existing?.response as object | null
}

/**
 * Salva resultado de booking para idempotência
 * 
 * @param key - Chave de idempotência
 * @param result - Resultado a salvar
 */
export async function saveBookingIdempotency(
  key: string,
  result: object
): Promise<void> {
  await prisma.idempotencyKey.upsert({
    where: { key },
    update: { response: result },
    create: {
      key,
      response: result,
    },
  })
}

/**
 * Limpa chaves de idempotência antigas
 * Chamar via cron diariamente
 * 
 * @param daysOld - Idade mínima em dias (default: 7)
 * @returns Número de chaves removidas
 */
export async function cleanupIdempotencyKeys(daysOld = 7): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)
  
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  })
  
  return result.count
}
