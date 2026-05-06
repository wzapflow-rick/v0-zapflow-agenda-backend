import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { z } from 'zod';

const assignServicesSchema = z.object({
  serviceIds: z.array(z.string().uuid()),
});

// GET /api/professionals/[id]/services - Listar serviços do profissional
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const professional = await prisma.professional.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!professional) {
      throw new NotFoundError('Profissional');
    }

    if (professional.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    return success(professional.services.map(ps => ps.service));
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/professionals/[id]/services - Atribuir serviços ao profissional
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;
    const body = await request.json();
    const { serviceIds } = assignServicesSchema.parse(body);

    const professional = await prisma.professional.findUnique({
      where: { id },
    });

    if (!professional) {
      throw new NotFoundError('Profissional');
    }

    if (professional.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    // Remove todas as atribuições existentes e cria novas
    await prisma.$transaction([
      prisma.professionalService.deleteMany({
        where: { professionalId: id },
      }),
      prisma.professionalService.createMany({
        data: serviceIds.map(serviceId => ({
          professionalId: id,
          serviceId,
        })),
      }),
    ]);

    const updated = await prisma.professional.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    return success(updated?.services.map(ps => ps.service));
  } catch (error) {
    return handleError(error);
  }
}
