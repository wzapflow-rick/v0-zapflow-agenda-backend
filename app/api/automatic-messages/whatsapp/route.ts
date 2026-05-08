import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ApiError } from '@/lib/api-utils';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// GET /api/automatic-messages/whatsapp - Obter status da conexão e QR Code
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    // Busca o estabelecimento para pegar o slug
    const establishment = await prisma.establishment.findUnique({
      where: { id: authResult.establishmentId },
      select: { slug: true },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    // Busca configurações existentes
    const settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: authResult.establishmentId },
    });

    const instanceName = settings?.whatsappInstanceName || `ZapFlow-Agenda_${establishment.slug}`;

    // Se não tiver Evolution API configurada, retorna erro
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return success({
        connected: false,
        error: 'Evolution API não configurada',
        instanceName,
      });
    }

    // Verifica status da instância na Evolution API
    try {
      const statusResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
        {
          headers: { 'apikey': EVOLUTION_API_KEY },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        if (statusData.state === 'open') {
          // Já está conectado
          return success({
            connected: true,
            phone: settings?.whatsappPhone,
            instanceName,
          });
        }
      }

      // Se não está conectado, tenta gerar QR Code
      // Primeiro, cria a instância se não existir
      await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });

      // Busca o QR Code
      const qrResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
        {
          headers: { 'apikey': EVOLUTION_API_KEY },
        }
      );

      if (qrResponse.ok) {
        const qrData = await qrResponse.json();
        
        // Salva o nome da instância nas configurações
        await prisma.automaticMessageSettings.upsert({
          where: { establishmentId: authResult.establishmentId },
          update: { whatsappInstanceName: instanceName },
          create: {
            establishmentId: authResult.establishmentId,
            whatsappInstanceName: instanceName,
            activeMessages: [],
          },
        });

        return success({
          connected: false,
          qrcode: qrData.base64 || qrData.qrcode?.base64,
          pairingCode: qrData.pairingCode,
          instanceName,
        });
      }

      return success({
        connected: false,
        error: 'Não foi possível gerar o QR Code',
        instanceName,
      });
    } catch (error) {
      console.error('[WhatsApp] Erro ao verificar status:', error);
      return success({
        connected: false,
        error: 'Erro ao conectar com Evolution API',
        instanceName,
      });
    }
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/automatic-messages/whatsapp - Atualizar status da conexão (webhook)
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    // Busca o estabelecimento para gerar o instanceName
    const establishment = await prisma.establishment.findUnique({
      where: { id: authResult.establishmentId },
      select: { slug: true },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    const body = await request.json();
    const { connected, phone, instanceName } = body;

    // Gera instanceName se nao foi fornecido
    const finalInstanceName = instanceName || `ZapFlow-Agenda_${establishment.slug}`;

    // Atualiza o status de conexão E o instanceName
    const settings = await prisma.automaticMessageSettings.upsert({
      where: { establishmentId: authResult.establishmentId },
      update: {
        whatsappConnected: connected,
        whatsappPhone: phone || null,
        whatsappInstanceName: finalInstanceName,
      },
      create: {
        establishmentId: authResult.establishmentId,
        whatsappConnected: connected,
        whatsappPhone: phone || null,
        whatsappInstanceName: finalInstanceName,
        activeMessages: [],
      },
    });

    return success({
      connected: settings.whatsappConnected,
      phone: settings.whatsappPhone,
      instanceName: settings.whatsappInstanceName,
    });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/automatic-messages/whatsapp - Desconectar WhatsApp
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: authResult.establishmentId },
    });

    if (!settings?.whatsappInstanceName) {
      throw new ApiError('Nenhuma instância WhatsApp configurada', 400);
    }

    // Desconecta na Evolution API
    if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      try {
        await fetch(
          `${EVOLUTION_API_URL}/instance/logout/${settings.whatsappInstanceName}`,
          {
            method: 'DELETE',
            headers: { 'apikey': EVOLUTION_API_KEY },
          }
        );
      } catch (error) {
        console.error('[WhatsApp] Erro ao desconectar:', error);
      }
    }

    // Atualiza o banco
    await prisma.automaticMessageSettings.update({
      where: { establishmentId: authResult.establishmentId },
      data: {
        whatsappConnected: false,
        whatsappPhone: null,
      },
    });

    return success({ message: 'WhatsApp desconectado com sucesso' });
  } catch (error) {
    return handleError(error);
  }
}
