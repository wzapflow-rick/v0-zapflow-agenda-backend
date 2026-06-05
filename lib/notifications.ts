import prisma from '@/lib/prisma';

export type NotificationType =
  | 'appointment_created'
  | 'appointment_cancelled'
  | 'appointment_reminder'
  | 'appointment_no_show'
  | 'client_created'
  | 'whatsapp_disconnected';

interface CreateNotificationParams {
  establishmentId: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// Cria uma notificacao no banco de dados
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        establishmentId: params.establishmentId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data,
      },
    });
    return notification;
  } catch (error) {
    console.error('[Notifications] Erro ao criar notificacao:', error);
    return null;
  }
}

// Notificacao de novo agendamento
export async function notifyAppointmentCreated(params: {
  establishmentId: string;
  appointmentId: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
}) {
  return createNotification({
    establishmentId: params.establishmentId,
    type: 'appointment_created',
    title: 'Novo Agendamento',
    message: `${params.clientName} agendou ${params.serviceName} para ${params.date} às ${params.time}`,
    data: { appointmentId: params.appointmentId },
  });
}

// Notificacao de agendamento cancelado
export async function notifyAppointmentCancelled(params: {
  establishmentId: string;
  appointmentId: string;
  clientName: string;
  date: string;
  time: string;
}) {
  return createNotification({
    establishmentId: params.establishmentId,
    type: 'appointment_cancelled',
    title: 'Agendamento Cancelado',
    message: `${params.clientName} cancelou o agendamento de ${params.date} às ${params.time}`,
    data: { appointmentId: params.appointmentId },
  });
}

// Notificacao de novo cliente
export async function notifyClientCreated(params: {
  establishmentId: string;
  clientId: string;
  clientName: string;
}) {
  return createNotification({
    establishmentId: params.establishmentId,
    type: 'client_created',
    title: 'Novo Cliente',
    message: `${params.clientName} se cadastrou`,
    data: { clientId: params.clientId },
  });
}

// Notificacao de WhatsApp desconectado
export async function notifyWhatsAppDisconnected(params: {
  establishmentId: string;
}) {
  return createNotification({
    establishmentId: params.establishmentId,
    type: 'whatsapp_disconnected',
    title: 'WhatsApp Desconectado',
    message: 'Sua conexão com o WhatsApp foi perdida. Reconecte nas configurações.',
  });
}

// Notificacao de cliente que nao compareceu (no-show)
export async function notifyAppointmentNoShow(params: {
  establishmentId: string;
  appointmentId: string;
  clientName: string;
  date: string;
  time: string;
}) {
  return createNotification({
    establishmentId: params.establishmentId,
    type: 'appointment_no_show',
    title: 'Cliente Não Compareceu',
    message: `${params.clientName} não compareceu ao agendamento de ${params.date} às ${params.time}`,
    data: { appointmentId: params.appointmentId },
  });
}

// Notificacao de lembrete de agendamento (disparada via cron)
export async function notifyAppointmentReminder(params: {
  establishmentId: string;
  appointmentId: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
}) {
  return createNotification({
    establishmentId: params.establishmentId,
    type: 'appointment_reminder',
    title: 'Lembrete de Agendamento',
    message: `${params.clientName} tem ${params.serviceName} agendado para ${params.date} às ${params.time}`,
    data: { appointmentId: params.appointmentId },
  });
}

// Verifica se ja existe uma notificacao de lembrete para um agendamento (evita duplicar)
export async function reminderNotificationExists(params: {
  establishmentId: string;
  appointmentId: string;
}): Promise<boolean> {
  try {
    const existing = await prisma.notification.findFirst({
      where: {
        establishmentId: params.establishmentId,
        type: 'appointment_reminder',
        data: {
          path: ['appointmentId'],
          equals: params.appointmentId,
        },
      },
      select: { id: true },
    });
    return existing !== null;
  } catch (error) {
    console.error('[Notifications] Erro ao verificar lembrete existente:', error);
    return false;
  }
}
