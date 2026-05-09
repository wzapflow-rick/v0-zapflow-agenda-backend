import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { z } from 'zod';
import { AVAILABLE_MESSAGE_TYPES, evolutionApi } from '@/lib/whatsapp';

const updateMessagesSchema = z.object({
  activeMessages: z.array(z.string()),
});

// GET /api/automatic-messages - Obter configurações de mensagens automáticas
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    // Busca estabelecimento para gerar instanceName
    const establishment = await prisma.establishment.findUnique({
      where: { id: authResult.establishmentId },
      select: { slug: true },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    const instanceName = `ZapFlow-Agenda_${establishment.slug}`;

    // Busca ou cria as configurações
    let settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: authResult.establishmentId },
    });

    if (!settings) {
      // Cria configurações padrão
      settings = await prisma.automaticMessageSettings.create({
        data: {
          establishmentId: authResult.establishmentId,
          activeMessages: [],
          whatsappInstanceName: instanceName,
        },
      });
    }

    // Consulta status real na Evolution API
    const evolutionStatus = await evolutionApi.getInstanceStatus(instanceName);
    
    // Se o status mudou, atualiza o banco
    if (evolutionStatus.connected !== settings.whatsappConnected) {
      settings = await prisma.automaticMessageSettings.update({
        where: { establishmentId: authResult.establishmentId },
        data: {
          whatsappConnected: evolutionStatus.connected,
          whatsappInstanceName: instanceName,
        },
      });
    }

    return success({
      activeMessages: settings.activeMessages,
      whatsappConnected: evolutionStatus.connected,
      whatsappPhone: settings.whatsappPhone,
      whatsappInstanceName: instanceName,
      availableMessages: AVAILABLE_MESSAGE_TYPES,
    });
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/automatic-messages - Atualizar mensagens ativas
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const body = await request.json();
    const { activeMessages } = updateMessagesSchema.parse(body);

    // Valida se todas as mensagens são válidas
    const validMessageIds = AVAILABLE_MESSAGE_TYPES.map(m => m.id);
    const invalidMessages = activeMessages.filter(m => !validMessageIds.includes(m as any));
    
    if (invalidMessages.length > 0) {
      return success(
        { error: `Mensagens inválidas: ${invalidMessages.join(', ')}` },
        400
      );
    }

    // Atualiza ou cria as configurações
    const settings = await prisma.automaticMessageSettings.upsert({
      where: { establishmentId: authResult.establishmentId },
      update: { activeMessages },
      create: {
        establishmentId: authResult.establishmentId,
        activeMessages,
      },
    });

    return success({
      activeMessages: settings.activeMessages,
      whatsappConnected: settings.whatsappConnected,
      whatsappPhone: settings.whatsappPhone,
    });
  } catch (error) {
    return handleError(error);
  }
}
