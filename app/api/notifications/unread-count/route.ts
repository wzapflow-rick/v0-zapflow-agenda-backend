import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';

// GET /api/notifications/unread-count - Conta notificacoes nao lidas
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const count = await prisma.notification.count({
      where: {
        establishmentId: authResult.establishmentId,
        read: false,
      },
    });

    return success({ count });
  } catch (error) {
    return handleError(error);
  }
}
