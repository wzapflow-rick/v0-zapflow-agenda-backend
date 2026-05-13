// Rate Limiting (OWASP A07 - Identification and Authentication Failures)
// Protege contra brute force e DDoS

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Em memoria (em producao, usar Redis/Upstash)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Limpa entradas expiradas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  // Numero maximo de requisicoes
  limit: number;
  // Janela de tempo em segundos
  windowSeconds: number;
}

// Configuracoes padrao por tipo de rota
export const RATE_LIMITS = {
  // Login - mais restritivo (previne brute force)
  login: { limit: 5, windowSeconds: 60 },
  // Registro - restritivo (previne spam)
  register: { limit: 3, windowSeconds: 60 },
  // Esqueci senha - restritivo
  forgotPassword: { limit: 3, windowSeconds: 300 },
  // APIs autenticadas - padrao
  authenticated: { limit: 100, windowSeconds: 60 },
  // APIs publicas - mais permissivo
  public: { limit: 60, windowSeconds: 60 },
  // Webhooks - alto volume
  webhook: { limit: 500, windowSeconds: 60 },
} as const;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Verifica rate limit para uma chave (IP, userId, etc)
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  const entry = rateLimitStore.get(key);
  
  // Se nao existe ou expirou, cria nova entrada
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt: now + windowMs,
      limit: config.limit,
    };
  }
  
  // Se atingiu o limite
  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit: config.limit,
    };
  }
  
  // Incrementa contador
  entry.count++;
  
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
    limit: config.limit,
  };
}

/**
 * Extrai IP do request
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

/**
 * Helper para criar resposta de rate limit excedido
 */
export function rateLimitExceeded(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Muitas requisicoes. Tente novamente mais tarde.',
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.resetAt.toString(),
        'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
      },
    }
  );
}

/**
 * Middleware helper para aplicar rate limit
 */
export function withRateLimit(
  request: Request,
  config: RateLimitConfig,
  keyPrefix: string = ''
): RateLimitResult | null {
  const ip = getClientIP(request);
  const key = `${keyPrefix}:${ip}`;
  
  const result = checkRateLimit(key, config);
  
  if (!result.success) {
    return result;
  }
  
  return null; // null = passou no rate limit
}
