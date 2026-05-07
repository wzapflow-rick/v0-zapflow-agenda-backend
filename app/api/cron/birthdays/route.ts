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

// GET /api/cron/birthdays - Envia mensagens de aniversário
// Configurar no vercel.json para rodar uma vez por dia às 9h
export async function GET(request: NextRequest) {
  try {
    if (!verifyCronAuth(request)) {
      return success({ error: 'Não autorizado' }, 401);
    }

    const now = new Date();
    const today = now.getDate();
    const thisMonth = now.getMonth() + 1; // getMonth() retorna 0-11

    const results = {
      checked: 0,
      sent: 0,
      errors: 0,
    };

    // Nota: Para implementar aniversários, você precisa adicionar um campo 'birthDate' no model Client
    // Por enquanto, este endpoint está preparado mas não funcional sem o campo

    // Busca todos os estabelecimentos com mensagem de aniversário ativa
    const establishmentsWithBirthday = await prisma.automaticMessageSettings.findMany({
      where: {
        activeMessages: { has: 'birthday' },
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

    // Para cada estabelecimento, buscar clientes aniversariantes
    // Isso requer que o modelo Client tenha um campo birthDate
    // Exemplo de como ficaria a query:
    /*
    for (const settings of establishmentsWithBirthday) {
      const clients = await prisma.client.findMany({
        where: {
          establishmentId: settings.establishmentId,
          birthDate: {
            // Comparar dia e mês
          }
        }
      });

      for (const client of clients) {
        const result = await sendMessageToClient(
          'birthday',
          settings.establishmentId,
          client,
          settings.establishment
        );

        if (result.success) results.sent++;
        else results.errors++;
      }
    }
    */

    console.log('[Cron] Aniversários processados:', results);
    console.log('[Cron] Nota: Para funcionar, adicione o campo birthDate ao model Client');

    return success({
      message: 'Aniversários processados (campo birthDate necessário no model Client)',
      results,
      establishmentsConfigured: establishmentsWithBirthday.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}
