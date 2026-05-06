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

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        duration: data.duration,
        price: data.price,
        active: data.isActive,
      },
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
