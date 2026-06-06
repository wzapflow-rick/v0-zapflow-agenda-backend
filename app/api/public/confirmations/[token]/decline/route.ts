import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { invalidateSlotsCache } from '@/lib/redis';
import { formatDateYMD, formatTimeHM } from '@/lib/confirmations';

// POST /api/public/confirmations/:token/decline
// Se estiver pending, marca declined/cancelled + cancelledAt. Se ja nao estiver
// pending, retorna o estado atual sem erro.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { confirmationToken: token },
      include: {
        client: { select: { name: true } },
        service: { select: { name: true } },
        professional: { select: { name: true } },
        establishment: { select: { name: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Confirmação');
    }

    let current = appointment;

    if (appointment.confirmationStatus === 'pending') {
      const updated = await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          confirmationStatus: 'declined',
          cancelledAt: new Date(),
          status: 'CANCELLED',
        },
        include: {
          client: { select: { name: true } },
          service: { select: { name: true } },
          professional: { select: { name: true } },
          establishment: { select: { name: true } },
        },
      });
      current = updated;

      // Libera o horario no cache de slots (nao bloqueia)
      invalidateSlotsCache(
        appointment.establishmentId,
        appointment.professionalId,
        formatDateYMD(appointment.date)
      ).catch((err) => {
        console.error('[Confirmations] Erro ao invalidar cache apos recusa:', err);
      });
    }

    return success({
      status: current.confirmationStatus,
      clientName: current.client.name,
      serviceName: current.service.name,
      professionalName: current.professional.name,
      establishmentName: current.establishment.name,
      date: formatDateYMD(current.date),
      startTime: formatTimeHM(current.startTime),
    });
  } catch (error) {
    return handleError(error);
  }
}
