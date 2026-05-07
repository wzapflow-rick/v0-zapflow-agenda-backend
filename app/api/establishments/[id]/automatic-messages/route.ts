import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError } from '@/lib/api-utils';

// GET /api/establishments/[id]/automatic-messages - Obter configurações
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) {
      return authResult.toResponse();
    }

    const { id } = await params;

    // Verifica se o estabelecimento pertence ao usuário
    if (authResult.establishmentId !== id) {
      throw new ForbiddenError('Sem permissão para acessar este estabelecimento');
    }

    let settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: id },
    });

    // Se não existe, cria com valores padrão
    if (!settings) {
      settings = await prisma.automaticMessageSettings.create({
        data: {
          establishmentId: id,
          activeMessages: [],
        },
      });
    }

    return success(settings);
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/establishments/[id]/automatic-messages - Atualizar configurações
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) {
      return authResult.toResponse();
    }

    const { id } = await params;

    // Verifica se o estabelecimento pertence ao usuário
    if (authResult.establishmentId !== id) {
      throw new ForbiddenError('Sem permissão para acessar este estabelecimento');
    }

    const body = await request.json();
    const { activeMessages } = body;

    const settings = await prisma.automaticMessageSettings.upsert({
      where: { establishmentId: id },
      update: {
        activeMessages: activeMessages || [],
      },
      create: {
        establishmentId: id,
        activeMessages: activeMessages || [],
      },
    });

    return success(settings);
  } catch (error) {
    return handleError(error);
  }
}
