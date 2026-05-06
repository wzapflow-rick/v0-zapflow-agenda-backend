import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { updateClientSchema } from '@/lib/validators';

// GET /api/clients/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        appointments: {
          include: {
            service: true,
            professional: true,
          },
          orderBy: { date: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            appointments: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundError('Cliente');
    }

    if (client.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    return success(client);
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/clients/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;
    const body = await request.json();
    const data = updateClientSchema.parse(body);

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundError('Cliente');
    }

    if (client.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
      },
    });

    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/clients/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundError('Cliente');
    }

    if (client.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    await prisma.client.delete({ where: { id } });

    return success({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    return handleError(error);
  }
}
