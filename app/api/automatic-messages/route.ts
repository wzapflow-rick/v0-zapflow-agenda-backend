import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { evolutionApi } from '@/lib/whatsapp';

// GET /api/automatic-messages - Obter status da conexao WhatsApp
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
      select: { slug: true, name: true },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    const instanceName = `ZapFlow-Agenda_${establishment.slug}`;

    // Busca ou cria as configuracoes
    let settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: authResult.establishmentId },
    });

    if (!settings) {
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
      whatsappConnected: evolutionStatus.connected,
      whatsappPhone: settings.whatsappPhone,
      whatsappInstanceName: instanceName,
    });
  } catch (error) {
    return handleError(error);
  }
}
