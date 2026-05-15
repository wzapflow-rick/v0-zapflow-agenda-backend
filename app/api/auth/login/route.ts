import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { success, handleError, ApiError } from '@/lib/api-utils';
import { loginSchema } from '@/lib/validators';
import { withRateLimit, RATE_LIMITS, rateLimitExceeded } from '@/lib/rate-limit';
import { auditLog, getRequestInfo } from '@/lib/audit-log';
import { sanitizeEmail } from '@/lib/sanitize';

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    console.log('[v0] POST /api/auth/login - Iniciando login...');
    
    // Rate limiting - previne brute force
    const rateLimitResult = withRateLimit(request, RATE_LIMITS.login, 'login');
    if (rateLimitResult) {
      const { ipAddress } = getRequestInfo(request);
      await auditLog({
        action: 'RATE_LIMIT_EXCEEDED',
        ipAddress,
        details: { route: '/api/auth/login' },
      });
      return rateLimitExceeded(rateLimitResult);
    }

    const body = await request.json();
    console.log('[v0] Body recebido:', { email: body.email, hasPassword: !!body.password });
    
    const data = loginSchema.parse(body);
    const { ipAddress, userAgent } = getRequestInfo(request);

    // Sanitiza email
    const email = sanitizeEmail(data.email);
    console.log('[v0] Email sanitizado:', email);

    // Busca usuario pelo email
    console.log('[v0] Buscando usuario no banco...');
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        establishment: true,
      },
    });

    if (!user) {
      console.log('[v0] Usuario nao encontrado para email:', email);
      // Log tentativa falha (email nao existe)
      await auditLog({
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'user_not_found' },
      });
      throw new ApiError('Email ou senha invalidos', 401);
    }

    console.log('[v0] Usuario encontrado:', { id: user.id, hasPassword: !!user.password });

    // Verifica a senha
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      // Log tentativa falha (senha errada)
      await auditLog({
        action: 'LOGIN_FAILED',
        userId: user.id,
        establishmentId: user.establishment?.id,
        ipAddress,
        userAgent,
        details: { reason: 'invalid_password' },
      });
      throw new ApiError('Email ou senha invalidos', 401);
    }

    // Gera token
    const token = generateToken({ userId: user.id, email: user.email });

    // Log sucesso
    await auditLog({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      establishmentId: user.establishment?.id,
      ipAddress,
      userAgent,
    });

    // Remove senha do retorno
    const { password: _, ...userWithoutPassword } = user;

    return success({
      user: {
        ...userWithoutPassword,
        establishmentId: user.establishment?.id,
      },
      token,
    });
  } catch (error) {
    return handleError(error);
  }
}
