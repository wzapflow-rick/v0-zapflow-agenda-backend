import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { error, handleError, success } from '@/lib/api-utils';
import { invalidateSlotsCache } from '@/lib/redis';
import {
  ACTION_TEMPLATE_MAP,
  DEFAULT_LEAD_TIME_HOURS,
  HOUR_MS,
  formatDateYMD,
  formatTimeHM,
  getAppointmentInstant,
  normalizeTemplates,
  verifyServiceToken,
  type ConfirmationAction,
} from '@/lib/confirmations';

interface DueActionItem {
  appointmentId: string;
  establishmentSlug: string;
  action: ConfirmationAction;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  professionalName: string;
  establishmentName: string;
  date: string;
  startTime: string;
  templateId: string | null;
  confirmationToken: string | null;
}

// GET /api/service/confirmations/due-actions
// Autenticado por header Authorization: Bearer <CONFIRMATION_SERVICE_TOKEN>
// Varre todos os estabelecimentos com fluxo habilitado e retorna as acoes "due".
export async function GET(request: NextRequest) {
  try {
    if (!verifyServiceToken(request.headers.get('authorization'))) {
      return error('Não autorizado', 401);
    }

    const now = new Date();
    const nowMs = now.getTime();

    // Janela inferior: ontem (UTC) para cobrir agendamentos do dia anterior em qualquer timezone
    const rangeStart = new Date(now);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
    rangeStart.setUTCHours(0, 0, 0, 0);

    // Estabelecimentos com fluxo de confirmacao habilitado
    const settingsList = await prisma.confirmationSettings.findMany({
      where: { enabled: true },
      include: {
        establishment: {
          select: { id: true, name: true, slug: true, timezone: true },
        },
      },
    });

    const items: DueActionItem[] = [];

    for (const settings of settingsList) {
      const establishment = settings.establishment;
      if (!establishment) continue;

      const timezone = establishment.timezone || 'America/Sao_Paulo';
      const leadTimeHours = settings.leadTimeHours ?? DEFAULT_LEAD_TIME_HOURS;
      const templates = normalizeTemplates(settings.templates);

      // Candidatos: agendamentos ativos (nao cancelados/concluidos) a partir de ontem
      const appointments = await prisma.appointment.findMany({
        where: {
          establishmentId: establishment.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          date: { gte: rangeStart },
        },
        include: {
          client: { select: { name: true, phone: true } },
          professional: { select: { name: true } },
          service: { select: { name: true } },
        },
      });

      for (const appt of appointments) {
        const instantMs = getAppointmentInstant(appt.date, appt.startTime, timezone).getTime();
        const cs = appt.confirmationStatus;
        const linkSentMs = appt.confirmationLinkSentAt?.getTime() ?? null;
        const reminderSentMs = appt.confirmationReminderSentAt?.getTime() ?? null;
        const reservationSentMs = appt.reservationMessageSentAt?.getTime() ?? null;
        const finalReminderSentMs = appt.finalReminderSentAt?.getTime() ?? null;

        let action: ConfirmationAction | null = null;

        if (cs === 'pending' && linkSentMs !== null && nowMs >= linkSentMs + 2 * HOUR_MS) {
          // Passou 2h do envio do link e ainda nao confirmou -> expira/cancela
          action = 'cancel_no_confirmation';
        } else if (
          cs === 'pending' &&
          linkSentMs !== null &&
          reminderSentMs === null &&
          nowMs >= linkSentMs + HOUR_MS
        ) {
          // Passou 1h do envio do link e ainda esta pendente -> lembrete
          action = 'send_confirmation_reminder';
        } else if (
          cs === 'confirmed' &&
          finalReminderSentMs === null &&
          instantMs > nowMs &&
          nowMs >= instantMs - HOUR_MS
        ) {
          // Confirmado e falta 1h para o atendimento -> lembrete final
          action = 'send_final_reminder';
        } else if (
          cs === 'pending' &&
          linkSentMs === null &&
          instantMs > nowMs &&
          nowMs >= instantMs - leadTimeHours * HOUR_MS
        ) {
          // Dentro da janela de lead time (ou em cima da hora) -> pedir confirmacao
          action = 'send_confirmation_request';
        } else if (cs === 'pending' && reservationSentMs === null && instantMs > nowMs) {
          // Recem-criado, reserva ainda nao enviada -> mensagem de reserva
          action = 'send_reservation';
        }

        if (!action) continue;

        // Para cancelamento por falta de confirmacao, ja aplica a transicao
        // (idempotencia: nao reaparece nas proximas varreduras)
        if (action === 'cancel_no_confirmation') {
          await prisma.appointment.update({
            where: { id: appt.id },
            data: {
              confirmationStatus: 'expired',
              status: 'CANCELLED',
              cancelledAt: now,
            },
          });

          invalidateSlotsCache(
            establishment.id,
            appt.professionalId,
            formatDateYMD(appt.date)
          ).catch((err) => {
            console.error('[Confirmations] Erro ao invalidar cache apos expirar:', err);
          });
        }

        items.push({
          appointmentId: appt.id,
          establishmentSlug: establishment.slug,
          action,
          clientName: appt.client.name,
          clientPhone: appt.client.phone,
          serviceName: appt.service.name,
          professionalName: appt.professional.name,
          establishmentName: establishment.name,
          date: formatDateYMD(appt.date),
          startTime: formatTimeHM(appt.startTime),
          templateId: templates[ACTION_TEMPLATE_MAP[action]] || null,
          confirmationToken: appt.confirmationToken,
        });
      }
    }

    return success({ actions: items, count: items.length, timestamp: now.toISOString() });
  } catch (err) {
    return handleError(err);
  }
}
