import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError } from '@/lib/api-utils';
import { sendMessageToClient } from '@/lib/whatsapp';

// Verifica o header de autorização do cron
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  const vercelCronHeader = request.headers.get('x-vercel-cron');
  if (vercelCronHeader) {
    return true;
  }

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

// GET /api/cron/reactivation - Envia mensagens para clientes inativos (30+ dias)
// Configurar no vercel.json para rodar uma vez por dia
export async function GET(request: NextRequest) {
  try {
    if (!verifyCronAuth(request)) {
      return success({ error: 'Não autorizado' }, 401);
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const results = {
      checked: 0,
      sent: 0,
      errors: 0,
    };

    // Busca estabelecimentos com mensagem de reativação ativa
    const establishmentsWithReactivation = await prisma.automaticMessageSettings.findMany({
      where: {
        activeMessages: { has: 'reactivation' },
        whatsappConnected: true,
      },
      include: {
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

    for (const settings of establishmentsWithReactivation) {
      // Busca clientes que:
      // 1. Não têm agendamentos nos últimos 30 dias
      // 2. Não receberam mensagem de reativação nos últimos 30 dias
      const inactiveClients = await prisma.client.findMany({
        where: {
          establishmentId: settings.establishmentId,
          // Tem pelo menos um agendamento anterior (é um cliente ativo)
          appointments: {
            some: {
              status: 'COMPLETED',
            },
          },
          // Não tem agendamentos recentes
          NOT: {
            appointments: {
              some: {
                date: { gte: thirtyDaysAgo },
                status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
              },
            },
          },
        },
        include: {
          // Pega o último agendamento para verificar
          appointments: {
            orderBy: { date: 'desc' },
            take: 1,
            select: { date: true, status: true },
          },
          // Verifica se já recebeu mensagem de reativação recentemente
          messageLogs: {
            where: {
              messageType: 'reactivation',
              createdAt: { gte: thirtyDaysAgo },
            },
            take: 1,
          },
        },
      });

      // Filtra clientes que não receberam reativação nos últimos 30 dias
      const clientsToReactivate = inactiveClients.filter(
        client => client.messageLogs.length === 0
      );

      results.checked += clientsToReactivate.length;

      for (const client of clientsToReactivate) {
        try {
          const result = await sendMessageToClient(
            'reactivation',
            settings.establishmentId,
            {
              id: client.id,
              name: client.name,
              phone: client.phone,
            },
            settings.establishment
          );

          if (result.success) {
            results.sent++;
          } else {
            results.errors++;
          }
        } catch (error) {
          console.error('[Cron] Erro ao enviar reativação:', error);
          results.errors++;
        }
      }
    }

    console.log('[Cron] Reativações processadas:', results);

    return success({
      message: 'Clientes inativos processados',
      results,
      establishmentsConfigured: establishmentsWithReactivation.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}
