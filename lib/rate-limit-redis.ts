import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

// Rate limiters para diferentes endpoints
// Sliding window: mais preciso, distribui requests uniformemente

// API Geral - 100 requests por minuto por IP
export const generalRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'ratelimit:general',
  analytics: true,
})

// Booking Publico - 10 agendamentos por minuto por IP (previne spam)
export const bookingRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'ratelimit:booking',
  analytics: true,
})

// Login/Auth - 5 tentativas por minuto por IP (previne brute force)
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'ratelimit:auth',
  analytics: true,
})

// Slots Query - 30 requests por minuto por IP (consultas pesadas)
export const slotsRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'ratelimit:slots',
  analytics: true,
})

// WhatsApp - 20 mensagens por minuto por estabelecimento
export const whatsappRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'ratelimit:whatsapp',
  analytics: true,
})

// Webhook - 100 requests por minuto (Mercado Pago pode enviar varios)
export const webhookRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'ratelimit:webhook',
  analytics: true,
})

// Tipos de rate limit disponiveis
export type RateLimitType = 'general' | 'booking' | 'auth' | 'slots' | 'whatsapp' | 'webhook'

// Mapa de rate limiters
const rateLimiters: Record<RateLimitType, Ratelimit> = {
  general: generalRateLimit,
  booking: bookingRateLimit,
  auth: authRateLimit,
  slots: slotsRateLimit,
  whatsapp: whatsappRateLimit,
  webhook: webhookRateLimit,
}

// Verifica se o Redis esta configurado
const isRedisConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
)

// Funcao helper para verificar rate limit
// FAIL-OPEN: se o Redis nao estiver configurado ou falhar,
// permite a requisicao em vez de derrubar o endpoint.
export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  // Se Redis nao esta configurado, libera (fail-open)
  if (!isRedisConfigured) {
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
    // Redis caiu ou erro de rede: libera a requisicao (fail-open)
    console.error('[RateLimit] Redis indisponivel, liberando requisicao:', error)
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
