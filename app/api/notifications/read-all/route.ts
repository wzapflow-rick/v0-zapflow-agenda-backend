import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';

// PUT /api/notifications/read-all - Marca todas as notificacoes como lidas
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const result = await prisma.notification.updateMany({
      where: {
        establishmentId: authResult.establishmentId,
        read: false,
      },
      data: { read: true },
    });

    return success({ updatedCount: result.count });
  } catch (error) {
    return handleError(error);
  }
}
