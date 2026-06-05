import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError } from '@/lib/api-utils';
import { sendAutomaticMessage } from '@/lib/whatsapp';
import { notifyAppointmentReminder, reminderNotificationExists } from '@/lib/notifications';

// Verifica o header de autorização do cron (Vercel Cron ou chave personalizada)
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Se CRON_SECRET estiver definido, verifica
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // Verifica se é uma chamada do Vercel Cron
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  if (vercelCronHeader) {
    return true;
  }

  // Em ambiente de desenvolvimento, permite sem autenticação
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

// GET /api/cron/reminders - Envia lembretes de agendamentos
// Configurar no vercel.json para rodar a cada hora
export async function GET(request: NextRequest) {
  try {
    if (!verifyCronAuth(request)) {
      return success({ error: 'Não autorizado' }, 401);
    }

    const now = new Date();
    const results = {
      reminder24h: { checked: 0, sent: 0, errors: 0 },
      reminder1h: { checked: 0, sent: 0, errors: 0 },
    };

    // =====================
    // LEMBRETE 24 HORAS
    // =====================
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Busca agendamentos de amanhã que ainda não receberam lembrete 24h
    const appointments24h = await prisma.appointment.findMany({
      where: {
        date: {
          gte: tomorrow,
          lte: tomorrowEnd,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
        // Verifica se não existe log de reminder_24h para este agendamento
        NOT: {
          messageLogs: {
            some: {
              messageType: 'reminder_24h',
            },
          },
        },
      },
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

    results.reminder24h.checked = appointments24h.length;

    for (const appointment of appointments24h) {
      try {
        const startTimeStr = appointment.startTime instanceof Date
          ? appointment.startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : String(appointment.startTime);

        const result = await sendAutomaticMessage('reminder_24h', {
          id: appointment.id,
          date: appointment.date,
          startTime: startTimeStr,
          client: appointment.client,
          professional: appointment.professional,
          service: appointment.service,
          establishment: appointment.establishment,
        });

        if (result.success) {
          results.reminder24h.sent++;
        } else {
          results.reminder24h.errors++;
        }

        // Cria notificacao interna de lembrete (com dedup por agendamento)
        const alreadyNotified = await reminderNotificationExists({
          establishmentId: appointment.establishment.id,
          appointmentId: appointment.id,
        });

        if (!alreadyNotified) {
          await notifyAppointmentReminder({
            establishmentId: appointment.establishment.id,
            appointmentId: appointment.id,
            clientName: appointment.client.name,
            serviceName: appointment.service.name,
            date: new Date(appointment.date).toLocaleDateString('pt-BR'),
            time: startTimeStr,
          });
        }
      } catch (error) {
        console.error('[Cron] Erro ao enviar lembrete 24h:', error);
        results.reminder24h.errors++;
      }
    }

    // =====================
    // LEMBRETE 1 HORA
    // =====================
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHour15FromNow = new Date(now.getTime() + 75 * 60 * 1000); // 15 min de margem

    // Busca agendamentos que começam em aproximadamente 1 hora
    const appointments1h = await prisma.appointment.findMany({
      where: {
        date: {
          gte: new Date(now.toDateString()),
          lte: new Date(now.toDateString()),
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
        NOT: {
          messageLogs: {
            some: {
              messageType: 'reminder_1h',
            },
          },
        },
      },
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

    // Filtra agendamentos que estão dentro da janela de 1 hora
    const filteredAppointments1h = appointments1h.filter(apt => {
      const aptTime = apt.startTime instanceof Date ? apt.startTime : new Date(`1970-01-01T${apt.startTime}`);
      const aptHour = aptTime.getHours();
      const aptMinute = aptTime.getMinutes();
      
      const nowPlusOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      const targetHour = nowPlusOneHour.getHours();
      const targetMinute = nowPlusOneHour.getMinutes();
      
      // Verifica se está dentro de uma janela de 15 minutos
      const aptTotalMinutes = aptHour * 60 + aptMinute;
      const targetTotalMinutes = targetHour * 60 + targetMinute;
      
      return Math.abs(aptTotalMinutes - targetTotalMinutes) <= 15;
    });

    results.reminder1h.checked = filteredAppointments1h.length;

    for (const appointment of filteredAppointments1h) {
      try {
        const startTimeStr = appointment.startTime instanceof Date
          ? appointment.startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : String(appointment.startTime);

        const result = await sendAutomaticMessage('reminder_1h', {
          id: appointment.id,
          date: appointment.date,
          startTime: startTimeStr,
          client: appointment.client,
          professional: appointment.professional,
          service: appointment.service,
          establishment: appointment.establishment,
        });

        if (result.success) {
          results.reminder1h.sent++;
        } else {
          results.reminder1h.errors++;
        }
      } catch (error) {
        console.error('[Cron] Erro ao enviar lembrete 1h:', error);
        results.reminder1h.errors++;
      }
    }

    console.log('[Cron] Lembretes processados:', results);

    return success({
      message: 'Lembretes processados',
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}
