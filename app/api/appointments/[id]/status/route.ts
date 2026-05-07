import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError } from '@/lib/api-utils';
import { NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { z } from 'zod';
import { sendAutomaticMessage, MessageType } from '@/lib/whatsapp';

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
});

// PUT /api/appointments/[id]/status - Atualizar status do agendamento
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;
    const body = await request.json();
    const { status } = updateStatusSchema.parse(body);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        professional: true,
      },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento');
    }

    if (appointment.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        client: true,
        professional: true,
        service: true,
        establishment: {
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
          },
        },
      },
    });

    // Envia mensagem automática baseada no novo status
    const statusMessageMap: Record<string, MessageType | null> = {
      'COMPLETED': 'thank_you',
      'CANCELLED': 'cancellation',
      'NO_SHOW': 'no_show',
    };

    const messageType = statusMessageMap[status];
    if (messageType) {
      const startTimeStr = updated.startTime instanceof Date
        ? updated.startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : String(updated.startTime);

      sendAutomaticMessage(messageType, {
        id: updated.id,
        date: updated.date,
        startTime: startTimeStr,
        client: updated.client,
        professional: updated.professional,
        service: updated.service,
        establishment: updated.establishment,
      }).catch(err => console.error(`[WhatsApp] Erro ao enviar ${messageType}:`, err));
    }

    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}
