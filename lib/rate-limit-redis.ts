import { Ratelimit } from '@upstash/ratelimit'
import { redis, isRedisConfigured } from './redis'

// Tipos de rate limit disponiveis
export type RateLimitType = 'general' | 'booking' | 'auth' | 'slots' | 'whatsapp' | 'webhook'

// Rate limiters para diferentes endpoints (so criados se o Redis estiver configurado)
// Sliding window: mais preciso, distribui requests uniformemente
const rateLimiters: Record<RateLimitType, Ratelimit> | null = (redis && isRedisConfigured)
  ? {
      // API Geral - 100 requests por minuto por IP
      general: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        prefix: 'ratelimit:general',
        analytics: true,
      }),
      // Booking Publico - 10 agendamentos por minuto por IP (previne spam)
      booking: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        prefix: 'ratelimit:booking',
        analytics: true,
      }),
      // Login/Auth - 5 tentativas por minuto por IP (previne brute force)
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        prefix: 'ratelimit:auth',
        analytics: true,
      }),
      // Slots Query - 30 requests por minuto por IP (consultas pesadas)
      slots: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        prefix: 'ratelimit:slots',
        analytics: true,
      }),
      // WhatsApp - 20 mensagens por minuto por estabelecimento
      whatsapp: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        prefix: 'ratelimit:whatsapp',
        analytics: true,
      }),
      // Webhook - 100 requests por minuto (Mercado Pago pode enviar varios)
      webhook: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        prefix: 'ratelimit:webhook',
        analytics: true,
      }),
    }
  : null

// Funcao helper para verificar rate limit
// Se o Redis nao estiver configurado, faz "fail-open" (permite a requisicao)
// para que a aplicacao continue funcionando sem Upstash.
export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  if (!rateLimiters) {
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }

  try {
    const limiter = rateLimiters[type]
    const result = await limiter.limit(identifier)

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    // Em caso de falha do Redis, nao bloqueia o usuario (fail-open)
    console.error('[RateLimit] Erro ao verificar rate limit:', error)
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
}

// Helper para extrair IP do request
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  return 'unknown'
}

// Response padrao para rate limit excedido
export function rateLimitResponse(reset: number) {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000)
  
  return new Response(
    JSON.stringify({
      error: 'Muitas requisicoes. Tente novamente em alguns segundos.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(reset),
      },
    }
  )
}
