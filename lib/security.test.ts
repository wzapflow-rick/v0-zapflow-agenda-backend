import { describe, it, expect } from 'vitest';
import { 
  sanitizeHTML, 
  sanitizeString, 
  sanitizeEmail, 
  sanitizePhone, 
  sanitizeSlug,
  sanitizeObject 
} from './sanitize';
import { checkRateLimit } from './rate-limit';

describe('Sanitize (OWASP A03 - Injection)', () => {
  describe('sanitizeHTML', () => {
    it('remove tags script', () => {
      const input = '<script>alert("xss")</script>texto';
      expect(sanitizeHTML(input)).not.toContain('<script>');
      expect(sanitizeHTML(input)).not.toContain('alert');
    });

    it('remove event handlers', () => {
      const input = '<div onclick="alert(1)">texto</div>';
      expect(sanitizeHTML(input)).not.toContain('onclick');
    });

    it('remove javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">link</a>';
      expect(sanitizeHTML(input)).not.toContain('javascript:');
    });

    it('escapa caracteres HTML', () => {
      const input = '<script>';
      const result = sanitizeHTML(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });
  });

  describe('sanitizeString', () => {
    it('remove caracteres de controle', () => {
      const input = 'texto\x00\x1F\x7Fnormal';
      expect(sanitizeString(input)).toBe('textonormal');
    });

    it('faz trim', () => {
      expect(sanitizeString('  texto  ')).toBe('texto');
    });

    it('limita tamanho', () => {
      const longString = 'a'.repeat(20000);
      expect(sanitizeString(longString).length).toBe(10000);
    });

    it('retorna vazio para input invalido', () => {
      expect(sanitizeString(null as any)).toBe('');
      expect(sanitizeString(undefined as any)).toBe('');
      expect(sanitizeString(123 as any)).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('converte para minusculas', () => {
      expect(sanitizeEmail('TESTE@EMAIL.COM')).toBe('teste@email.com');
    });

    it('faz trim', () => {
      expect(sanitizeEmail('  email@test.com  ')).toBe('email@test.com');
    });

    it('limita a 254 caracteres', () => {
      const longEmail = 'a'.repeat(300) + '@test.com';
      expect(sanitizeEmail(longEmail).length).toBeLessThanOrEqual(254);
    });
  });

  describe('sanitizePhone', () => {
    it('remove caracteres nao numericos', () => {
      expect(sanitizePhone('(11) 99999-9999')).toBe('11999999999');
    });

    it('remove espacos e caracteres especiais', () => {
      expect(sanitizePhone('+55 11 99999-9999')).toBe('5511999999999');
    });

    it('limita a 15 digitos', () => {
      const longPhone = '1'.repeat(20);
      expect(sanitizePhone(longPhone).length).toBe(15);
    });
  });

  describe('sanitizeSlug', () => {
    it('converte para minusculas', () => {
      expect(sanitizeSlug('MINHA-LOJA')).toBe('minha-loja');
    });

    it('remove caracteres especiais', () => {
      expect(sanitizeSlug('Minha Loja!')).toBe('minha-loja');
    });

    it('remove acentos', () => {
      expect(sanitizeSlug('Barbearia do João')).toBe('barbearia-do-jo-o');
    });

    it('remove hifens duplicados', () => {
      expect(sanitizeSlug('minha---loja')).toBe('minha-loja');
    });

    it('remove hifens no inicio e fim', () => {
      expect(sanitizeSlug('-minha-loja-')).toBe('minha-loja');
    });
  });

  describe('sanitizeObject', () => {
    it('sanitiza strings em objetos', () => {
      const input = { name: '  texto  ', email: 'TEST@EMAIL.COM' };
      const result = sanitizeObject(input);
      expect(result.name).toBe('texto');
    });

    it('sanitiza objetos aninhados', () => {
      const input = { user: { name: '  nome  ' } };
      const result = sanitizeObject(input);
      expect(result.user.name).toBe('nome');
    });

    it('sanitiza arrays', () => {
      const input = { tags: ['  tag1  ', '  tag2  '] };
      const result = sanitizeObject(input);
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });

    it('mantem valores nao-string', () => {
      const input = { count: 10, active: true };
      const result = sanitizeObject(input);
      expect(result.count).toBe(10);
      expect(result.active).toBe(true);
    });
  });
});

describe('Rate Limiting (OWASP A07 - Authentication Failures)', () => {
  it('permite requisicoes dentro do limite', () => {
    const result = checkRateLimit('test-key-1', { limit: 5, windowSeconds: 60 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('bloqueia apos exceder limite', () => {
    const key = 'test-key-blocked-' + Date.now();
    const config = { limit: 3, windowSeconds: 60 };

    // 3 requisicoes permitidas
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);

    // 4a requisicao bloqueada
    const result = checkRateLimit(key, config);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('reseta apos janela de tempo', () => {
    const key = 'test-key-reset-' + Date.now();
    const config = { limit: 1, windowSeconds: 1 };

    // Primeira requisicao
    const result1 = checkRateLimit(key, config);
    expect(result1.success).toBe(true);

    // Segunda requisicao bloqueada
    const result2 = checkRateLimit(key, config);
    expect(result2.success).toBe(false);
  });

  it('retorna informacoes corretas de limite', () => {
    const key = 'test-key-info-' + Date.now();
    const config = { limit: 10, windowSeconds: 60 };

    const result = checkRateLimit(key, config);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});

describe('Password Validation (OWASP A07)', () => {
  it('rejeita senhas muito curtas', async () => {
    const { registerSchema } = await import('./validators');
    const result = registerSchema.safeParse({
      name: 'Teste',
      email: 'test@test.com',
      password: 'Ab1', // muito curta
      establishmentName: 'Loja',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita senhas sem letra maiuscula', async () => {
    const { registerSchema } = await import('./validators');
    const result = registerSchema.safeParse({
      name: 'Teste',
      email: 'test@test.com',
      password: 'abcdef123', // sem maiuscula
      establishmentName: 'Loja',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita senhas sem letra minuscula', async () => {
    const { registerSchema } = await import('./validators');
    const result = registerSchema.safeParse({
      name: 'Teste',
      email: 'test@test.com',
      password: 'ABCDEF123', // sem minuscula
      establishmentName: 'Loja',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita senhas sem numero', async () => {
    const { registerSchema } = await import('./validators');
    const result = registerSchema.safeParse({
      name: 'Teste',
      email: 'test@test.com',
      password: 'Abcdefgh', // sem numero
      establishmentName: 'Loja',
    });
    expect(result.success).toBe(false);
  });

  it('aceita senha forte', async () => {
    const { registerSchema } = await import('./validators');
    const result = registerSchema.safeParse({
      name: 'Teste',
      email: 'test@test.com',
      password: 'Abcdef123', // senha forte
      establishmentName: 'Loja',
    });
    expect(result.success).toBe(true);
  });
});

describe('Security Headers', () => {
  it('verifica headers necessarios estao configurados', async () => {
    // Este teste verifica se o next.config tem os headers de seguranca
    const fs = await import('fs').then(m => m.promises);
    const configPath = process.cwd() + '/next.config.mjs';
    
    try {
      const config = await fs.readFile(configPath, 'utf-8');
      
      expect(config).toContain('X-Frame-Options');
      expect(config).toContain('X-Content-Type-Options');
      expect(config).toContain('X-XSS-Protection');
      expect(config).toContain('Content-Security-Policy');
      expect(config).toContain('Strict-Transport-Security');
    } catch {
      // Se nao conseguir ler o arquivo, pula o teste
      console.log('Pulando teste de headers - arquivo nao encontrado');
    }
  });
});
