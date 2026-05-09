import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ApiError } from '@/lib/api-utils';
import { z } from 'zod';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

const testMessageSchema = z.object({
  phone: z.string().min(10, 'Telefone inválido'),
  message: z.string().min(1, 'Mensagem obrigatória'),
});

// POST /api/automatic-messages/test - Enviar mensagem de teste
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const body = await request.json();
    const data = testMessageSchema.parse(body);

    // Busca configurações do WhatsApp
    const settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: authResult.establishmentId },
    });

    if (!settings?.whatsappInstanceName) {
      throw new ApiError('WhatsApp não configurado. Configure primeiro em Mensagens Automáticas.', 400);
    }

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new ApiError('Evolution API não configurada no servidor.', 500);
    }

    // Formata o telefone (remove caracteres especiais e adiciona @s.whatsapp.net)
    const formattedPhone = data.phone.replace(/\D/g, '');

    // Envia a mensagem via Evolution API
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${settings.whatsappInstanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: data.message,
        }),
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp Test] Erro ao enviar:', responseData);
      throw new ApiError(
        responseData.message || 'Erro ao enviar mensagem de teste',
        response.status
      );
    }

    return success({
      message: 'Mensagem de teste enviada com sucesso!',
      details: {
        phone: formattedPhone,
        instanceName: settings.whatsappInstanceName,
        response: responseData,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
