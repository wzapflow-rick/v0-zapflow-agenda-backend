import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError } from '@/lib/api-utils';
import { NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { z } from 'zod';
import { sendAutomaticMessage, MessageType } from '@/lib/whatsapp';
import { notifyAppointmentCancelled, notifyAppointmentNoShow } from '@/lib/notifications';

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
});

// Mapeia status para tipo de mensagem
const STATUS_TO_MESSAGE_TYPE: Record<string, MessageType | null> = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancellation',
  COMPLETED: 'thank_you',
  NO_SHOW: 'no_show',
  PENDING: null,
};

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
        client: true,
        service: true,
        establishment: true,
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
      },
    });

    // Cria notificacao interna baseada no novo status (nao bloqueia a resposta)
    const dateFormatted = new Date(appointment.date).toLocaleDateString('pt-BR');
    const timeFormatted = appointment.startTime instanceof Date
      ? appointment.startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : String(appointment.startTime);

    if (status === 'CANCELLED') {
      notifyAppointmentCancelled({
        establishmentId: appointment.establishmentId,
        appointmentId: appointment.id,
        clientName: appointment.client.name,
        date: dateFormatted,
        time: timeFormatted,
      }).catch((error) => {
        console.error('[Notifications] Erro ao criar notificacao de cancelamento:', error);
      });
    } else if (status === 'NO_SHOW') {
      notifyAppointmentNoShow({
        establishmentId: appointment.establishmentId,
        appointmentId: appointment.id,
        clientName: appointment.client.name,
        date: dateFormatted,
        time: timeFormatted,
      }).catch((error) => {
        console.error('[Notifications] Erro ao criar notificacao de no-show:', error);
      });
    }

    // Envia mensagem automatica baseada no novo status (nao bloqueia a resposta)
    const messageType = STATUS_TO_MESSAGE_TYPE[status];
    if (messageType) {
      sendAutomaticMessage(messageType, {
        id: appointment.id,
        date: appointment.date,
        startTime: appointment.startTime,
        client: {
          id: appointment.client.id,
          name: appointment.client.name,
          phone: appointment.client.phone,
        },
        professional: {
          name: appointment.professional.name,
        },
        service: {
          name: appointment.service.name,
        },
        establishment: {
          id: appointment.establishment.id,
          name: appointment.establishment.name,
          slug: appointment.establishment.slug,
          address: appointment.establishment.address,
        },
      }).catch((error) => {
        console.error(`[WhatsApp] Erro ao enviar mensagem ${messageType}:`, error);
      });
    }

    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}
