import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { success, handleError } from '@/lib/api-utils';
import { registerSchema } from '@/lib/validators';
import { withRateLimit, RATE_LIMITS, rateLimitExceeded } from '@/lib/rate-limit';
import { auditLog, getRequestInfo } from '@/lib/audit-log';
import { sanitizeEmail, sanitizeString, sanitizePhone, sanitizeSlug } from '@/lib/sanitize';

// POST /api/auth/register
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - previne spam de registros
    const rateLimitResult = withRateLimit(request, RATE_LIMITS.register, 'register');
    if (rateLimitResult) {
      return rateLimitExceeded(rateLimitResult);
    }

    const body = await request.json();
    const data = registerSchema.parse(body);
    const { ipAddress, userAgent } = getRequestInfo(request);

    // Sanitiza inputs
    const email = sanitizeEmail(data.email);
    const name = sanitizeString(data.name);
    const phone = data.phone ? sanitizePhone(data.phone) : null;
    const establishmentName = sanitizeString(data.establishmentName);

    // Verifica se o email ja esta em uso
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return success({ error: 'Email ja esta em uso' }, 409);
    }

    // Cria slug unico para o estabelecimento
    const baseSlug = sanitizeSlug(establishmentName);

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.establishment.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Hash da senha (bcrypt com cost factor 12 para maior seguranca)
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Horario de funcionamento padrao
    const defaultBusinessHours = {
      monday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      tuesday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      wednesday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      thursday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      friday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      saturday: { isOpen: true, openTime: '09:00', closeTime: '13:00' },
      sunday: { isOpen: false, openTime: '09:00', closeTime: '18:00' },
    };

    // Cria usuario com estabelecimento
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        establishment: {
          create: {
            name: establishmentName,
            slug,
            businessHours: defaultBusinessHours,
          },
        },
      },
      include: {
        establishment: true,
      },
    });

    // Log de registro
    await auditLog({
      action: 'REGISTER',
      userId: user.id,
      establishmentId: user.establishment?.id,
      ipAddress,
      userAgent,
      details: { email },
    });

    // Gera token
    const token = generateToken({ userId: user.id, email: user.email });

    // Remove senha do retorno
    const { password: _, ...userWithoutPassword } = user;

    return success({
      user: {
        ...userWithoutPassword,
        establishmentId: user.establishment?.id,
      },
      token,
    }, 201);
  } catch (error) {
    return handleError(error);
  }
}
