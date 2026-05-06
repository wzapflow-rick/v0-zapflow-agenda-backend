import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError } from '@/lib/api-utils';

// GET /api/auth/me - Retorna dados do usuario autenticado
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const user = await prisma.user.findUnique({
      where: { id: authResult.id },
      include: {
        establishment: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!user) {
      return success({ error: 'Usuario nao encontrado' }, 404);
    }

    // Remove senha do retorno e adiciona establishmentId
    const { password: _, ...userWithoutPassword } = user;

    return success({
      ...userWithoutPassword,
      establishmentId: user.establishment?.id || null,
    });
  } catch (error) {
    return handleError(error);
  }
}
