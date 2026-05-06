import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { createProfessionalSchema } from '@/lib/validators';

// GET /api/professionals - Listar profissionais
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const active = searchParams.get('active');

    const where = {
      establishmentId: authResult.establishmentId,
      ...(active !== null && { active: active === 'true' }),
    };

    const [professionals, total] = await Promise.all([
      prisma.professional.findMany({
        where,
        include: {
          services: {
            include: {
              service: true,
            },
          },
          _count: {
            select: {
              appointments: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.professional.count({ where }),
    ]);

    return success({
      professionals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/professionals - Criar profissional
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const body = await request.json();
    const data = createProfessionalSchema.parse(body);

    const professional = await prisma.professional.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        avatar: data.avatarUrl,
        bio: data.bio,
        workingHours: data.workingHours,
        establishmentId: authResult.establishmentId,
      },
    });

    return success(professional, 201);
  } catch (error) {
    return handleError(error);
  }
}
