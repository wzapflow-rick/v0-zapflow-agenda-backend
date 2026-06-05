import { Redis } from '@upstash/redis'

// Verifica se o Redis (Upstash) esta configurado via variaveis de ambiente.
// Se nao estiver, a aplicacao continua funcionando com degradacao graciosa:
// - rate limit "fail-open" (permite requisicoes)
// - cache de slots desativado
// - metricas desativadas
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

export const isRedisConfigured = Boolean(REDIS_URL && REDIS_TOKEN)

// Cliente Redis singleton - so e criado se as credenciais existirem.
// Quando nao configurado, `redis` e `null` e o codigo deve verificar antes de usar.
export const redis: Redis | null = isRedisConfigured
  ? new Redis({
      url: REDIS_URL!,
      token: REDIS_TOKEN!,
    })
  : null

// Helper para verificar se Redis esta disponivel
export async function isRedisAvailable(): Promise<boolean> {
  if (!redis) return false
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
  if (!redis) return
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
  if (!redis) return
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
