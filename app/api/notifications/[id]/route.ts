import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError } from '@/lib/api-utils';

// DELETE /api/notifications/[id] - Remove uma notificacao
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const { id } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundError('Notificacao');
    }

    if (notification.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    await prisma.notification.delete({
      where: { id },
    });

    return success({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
