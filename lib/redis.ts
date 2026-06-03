import { Redis } from '@upstash/redis'

// Cliente Redis singleton
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Helper para verificar se Redis esta disponivel
export async function isRedisAvailable(): Promise<boolean> {
  try {
    await redis.ping()
    return true
  } catch {
    return false
  }
}

// Invalida cache de slots para um profissional em uma data especifica
export async function invalidateSlotsCache(
  establishmentId: string,
  professionalId: string,
  date: string
): Promise<void> {
  try {
    // Pattern para deletar todos os caches de slots para esse profissional/data
    // Como Upstash nao suporta SCAN, deletamos a chave mais comum
    const pattern = `slots:${establishmentId}:${professionalId}:*:${date}`
    
    // Busca todas as chaves que correspondem ao pattern (limitado)
    const keys = await redis.keys(pattern)
    
    if (keys.length > 0) {
      await redis.del(...keys)
      console.log(`[Cache] Invalidado ${keys.length} chaves de slots para profissional ${professionalId} em ${date}`)
    }
  } catch (error) {
    console.error('[Cache] Erro ao invalidar cache de slots:', error)
  }
}

// Invalida todo o cache de slots para um estabelecimento
export async function invalidateEstablishmentSlotsCache(establishmentId: string): Promise<void> {
  try {
    const pattern = `slots:${establishmentId}:*`
    const keys = await redis.keys(pattern)
    
    if (keys.length > 0) {
      await redis.del(...keys)
      console.log(`[Cache] Invalidado ${keys.length} chaves de slots para estabelecimento ${establishmentId}`)
    }
  } catch (error) {
    console.error('[Cache] Erro ao invalidar cache de estabelecimento:', error)
  }
}
