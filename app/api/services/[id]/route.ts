import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { updateServiceSchema } from '@/lib/validators';

// GET /api/services/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const service = await prisma.service.findUnique({
      where: { id },
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
    });

    if (!service) {
      throw new NotFoundError('Serviço');
    }

    if (service.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    return success(service);
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/services/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;
    const body = await request.json();
    const data = updateServiceSchema.parse(body);

    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundError('Serviço');
    }

    if (service.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    // Se professionalIds foi enviado, valida posse e sincroniza o vinculo
    let validProfessionalIds: string[] | null = null;
    if (data.professionalIds !== undefined) {
      if (data.professionalIds.length > 0) {
        const owned = await prisma.professional.findMany({
          where: {
            id: { in: data.professionalIds },
            establishmentId: authResult.establishmentId,
          },
          select: { id: true },
        });
        validProfessionalIds = owned.map((p) => p.id);
      } else {
        validProfessionalIds = [];
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const svc = await tx.service.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          duration: data.duration,
          price: data.price,
          active: data.isActive,
        },
      });

      // Substitui o conjunto de profissionais (remove os antigos, cria os novos)
      if (validProfessionalIds !== null) {
        await tx.professionalService.deleteMany({ where: { serviceId: id } });
        if (validProfessionalIds.length > 0) {
          await tx.professionalService.createMany({
            data: validProfessionalIds.map((professionalId) => ({
              professionalId,
              serviceId: id,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.service.findUnique({
        where: { id },
        include: {
          professionals: { include: { professional: true } },
        },
      });
    });

    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/services/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundError('Serviço');
    }

    if (service.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    await prisma.service.delete({ where: { id } });

    return success({ message: 'Serviço excluído com sucesso' });
  } catch (error) {
    return handleError(error);
  }
}
