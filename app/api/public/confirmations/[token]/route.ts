import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { formatDateYMD, formatTimeHM } from '@/lib/confirmations';

// GET /api/public/confirmations/:token
// Endpoint publico (autenticado apenas pelo token). 404 se token invalido.
export async function GET(
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

    return success({
      status: appointment.confirmationStatus,
      clientName: appointment.client.name,
      serviceName: appointment.service.name,
      professionalName: appointment.professional.name,
      establishmentName: appointment.establishment.name,
      date: formatDateYMD(appointment.date),
      startTime: formatTimeHM(appointment.startTime),
    });
  } catch (error) {
    return handleError(error);
  }
}
