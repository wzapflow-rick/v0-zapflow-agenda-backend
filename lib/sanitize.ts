// Sanitizacao de Input (OWASP A03 - Injection)
// Protege contra XSS e injection attacks

/**
 * Remove tags HTML perigosas e scripts
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    // Remove tags script
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs (exceto imagens)
    .replace(/data:(?!image\/(png|jpg|jpeg|gif|webp))[^;]+;/gi, '')
    // Escape caracteres HTML basicos
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitiza string para uso seguro (remove apenas caracteres perigosos)
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    // Remove caracteres de controle
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Limita tamanho
    .slice(0, 10000);
}

/**
 * Sanitiza email
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  
  return email
    .toLowerCase()
    .trim()
    .slice(0, 254); // RFC 5321
}

/**
 * Sanitiza telefone (mantem apenas numeros)
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  
  return phone.replace(/\D/g, '').slice(0, 15);
}

/**
 * Sanitiza slug (URL-safe)
 */
export function sanitizeSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') return '';
  
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/**
 * Sanitiza objeto recursivamente
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : 
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) : 
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Valida e sanitiza parametros de query
 */
export function sanitizeQueryParams(params: URLSearchParams): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of params.entries()) {
    // Apenas permite caracteres alfanumericos no key
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
    if (safeKey) {
      sanitized[safeKey] = sanitizeString(value);
    }
  }
  
  return sanitized;
}
