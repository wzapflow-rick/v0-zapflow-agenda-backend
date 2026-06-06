import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { error, handleError, success } from '@/lib/api-utils';
import { confirmationReportSchema } from '@/lib/validators';
import { verifyServiceToken } from '@/lib/confirmations';

// POST /api/service/confirmations/report
// Autenticado por header Authorization: Bearer <CONFIRMATION_SERVICE_TOKEN>
// O frontend reporta o que executou; atualizamos os timestamps de idempotencia.
export async function POST(request: NextRequest) {
  try {
    if (!verifyServiceToken(request.headers.get('authorization'))) {
      return error('Não autorizado', 401);
    }

    const body = await request.json();
    const { results } = confirmationReportSchema.parse(body);

    const now = new Date();
    const summary = { updated: 0, skipped: 0, notFound: 0 };

    for (const item of results) {
      // Garante que o agendamento existe
      const appointment = await prisma.appointment.findUnique({
        where: { id: item.appointmentId },
        select: { id: true, confirmationStatus: true, status: true },
      });

      if (!appointment) {
        summary.notFound++;
        continue;
      }

      // Acoes que falharam nao gravam timestamp (serao reemitidas)
      if (!item.success && item.action !== 'cancel_no_confirmation') {
        summary.skipped++;
        continue;
      }

      const data: Record<string, unknown> = {};

      switch (item.action) {
        case 'send_reservation':
          data.reservationMessageSentAt = now;
          break;
        case 'send_confirmation_request':
          data.confirmationLinkSentAt = now;
          break;
        case 'send_confirmation_reminder':
          data.confirmationReminderSentAt = now;
          break;
        case 'send_final_reminder':
          data.finalReminderSentAt = now;
          break;
        case 'cancel_no_confirmation':
          // A transicao ja foi aplicada no due-actions; garante consistencia
          if (appointment.confirmationStatus !== 'expired') {
            data.confirmationStatus = 'expired';
          }
          if (appointment.status !== 'CANCELLED') {
            data.status = 'CANCELLED';
            data.cancelledAt = now;
          }
          break;
      }

      if (Object.keys(data).length === 0) {
        summary.skipped++;
        continue;
      }

      await prisma.appointment.update({
        where: { id: item.appointmentId },
        data,
      });
      summary.updated++;
    }

    return success({ summary, timestamp: now.toISOString() });
  } catch (err) {
    return handleError(err);
  }
}
