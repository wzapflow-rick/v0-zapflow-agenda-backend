import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { createServiceSchema } from '@/lib/validators';

// GET /api/services - Listar serviços
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
    const category = searchParams.get('category');

    const where = {
      establishmentId: authResult.establishmentId,
      ...(active !== null && { active: active === 'true' }),
      ...(category && { category }),
    };

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          professionals: {
            include: {
              professional: true,
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
      prisma.service.count({ where }),
    ]);

    return success({
      services,
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

// POST /api/services - Criar serviço
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const body = await request.json();
    const data = createServiceSchema.parse(body);

    // Valida que os profissionais informados pertencem ao estabelecimento
    let validProfessionalIds: string[] = [];
    if (data.professionalIds && data.professionalIds.length > 0) {
      const owned = await prisma.professional.findMany({
        where: {
          id: { in: data.professionalIds },
          establishmentId: authResult.establishmentId,
        },
        select: { id: true },
      });
      validProfessionalIds = owned.map((p) => p.id);
    }

    const service = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        duration: data.duration,
        price: data.price,
        establishmentId: authResult.establishmentId,
        professionals: {
          create: validProfessionalIds.map((professionalId) => ({
            professionalId,
          })),
        },
      },
      include: {
        professionals: { include: { professional: true } },
      },
    });

    return success(service, 201);
  } catch (error) {
    return handleError(error);
  }
}
