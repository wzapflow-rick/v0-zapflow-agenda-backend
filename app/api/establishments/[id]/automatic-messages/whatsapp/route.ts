import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError, ApiError } from '@/lib/api-utils';
import { evolutionApi } from '@/lib/whatsapp';

// GET /api/establishments/[id]/automatic-messages/whatsapp - Status da conexão
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

    if (authResult.establishmentId !== id) {
      throw new ForbiddenError('Sem permissão para acessar este estabelecimento');
    }

    const settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: id },
    });

    if (!settings?.whatsappInstanceName) {
      return success({
        connected: false,
        instanceName: null,
        phone: null,
        qrCode: null,
      });
    }

    // Busca status na Evolution API
    const status = await evolutionApi.getInstanceStatus(settings.whatsappInstanceName);

    return success({
      connected: status.connected,
      instanceName: settings.whatsappInstanceName,
      phone: settings.whatsappPhone,
      qrCode: status.qrCode,
    });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/establishments/[id]/automatic-messages/whatsapp - Criar/conectar instância
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) {
      return authResult.toResponse();
    }

    const { id } = await params;

    if (authResult.establishmentId !== id) {
      throw new ForbiddenError('Sem permissão para acessar este estabelecimento');
    }

    // Busca o estabelecimento para usar o slug como nome da instância
    const establishment = await prisma.establishment.findUnique({
      where: { id },
      select: { slug: true },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento não encontrado');
    }

    const instanceName = `zapflow_${establishment.slug}`;

    // Cria instância na Evolution API
    const result = await evolutionApi.createInstance(instanceName);

    // Atualiza as configurações
    await prisma.automaticMessageSettings.upsert({
      where: { establishmentId: id },
      update: {
        whatsappInstanceName: instanceName,
        whatsappConnected: false,
      },
      create: {
        establishmentId: id,
        whatsappInstanceName: instanceName,
        activeMessages: [],
      },
    });

    return success({
      instanceName,
      qrCode: result.qrCode,
      status: 'connecting',
    }, 201);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/establishments/[id]/automatic-messages/whatsapp - Desconectar
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) {
      return authResult.toResponse();
    }

    const { id } = await params;

    if (authResult.establishmentId !== id) {
      throw new ForbiddenError('Sem permissão para acessar este estabelecimento');
    }

    const settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: id },
    });

    if (settings?.whatsappInstanceName) {
      // Deleta instância na Evolution API
      await evolutionApi.deleteInstance(settings.whatsappInstanceName);
    }

    // Atualiza configurações
    await prisma.automaticMessageSettings.update({
      where: { establishmentId: id },
      data: {
        whatsappInstanceName: null,
        whatsappConnected: false,
        whatsappPhone: null,
      },
    });

    return success({ message: 'WhatsApp desconectado com sucesso' });
  } catch (error) {
    return handleError(error);
  }
}
