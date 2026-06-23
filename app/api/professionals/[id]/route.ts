import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { updateProfessionalSchema } from '@/lib/validators';

// GET /api/professionals/[id]
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
        _count: {
          select: {
            appointments: true,
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

    return success(professional);
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/professionals/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;
    const body = await request.json();
    const data = updateProfessionalSchema.parse(body);

    const professional = await prisma.professional.findUnique({
      where: { id },
    });

    if (!professional) {
      throw new NotFoundError('Profissional');
    }

    if (professional.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    // Se serviceIds foi enviado, valida posse e sincroniza o vinculo
    let validServiceIds: string[] | null = null;
    if (data.serviceIds !== undefined) {
      if (data.serviceIds.length > 0) {
        const owned = await prisma.service.findMany({
          where: {
            id: { in: data.serviceIds },
            establishmentId: authResult.establishmentId,
          },
          select: { id: true },
        });
        validServiceIds = owned.map((s) => s.id);
      } else {
        validServiceIds = [];
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.professional.update({
        where: { id },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          avatar: data.avatarUrl ?? data.avatar,
          bio: data.bio,
          workingHours: data.workingHours,
          active: data.isActive,
        },
      });

      // Substitui o conjunto de servicos (remove os antigos, cria os novos)
      if (validServiceIds !== null) {
        await tx.professionalService.deleteMany({ where: { professionalId: id } });
        if (validServiceIds.length > 0) {
          await tx.professionalService.createMany({
            data: validServiceIds.map((serviceId) => ({
              professionalId: id,
              serviceId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.professional.findUnique({
        where: { id },
        include: {
          services: { include: { service: true } },
        },
      });
    });

    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/professionals/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const professional = await prisma.professional.findUnique({
      where: { id },
    });

    if (!professional) {
      throw new NotFoundError('Profissional');
    }

    if (professional.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    await prisma.professional.delete({ where: { id } });

    return success({ message: 'Profissional excluído com sucesso' });
  } catch (error) {
    return handleError(error);
  }
}
