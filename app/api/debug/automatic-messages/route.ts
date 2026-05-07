import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError } from '@/lib/api-utils';
import { authenticate, isAuthError } from '@/lib/auth';

// GET /api/debug/automatic-messages - Verifica status das configurações
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) {
      return authResult.response;
    }

    // Busca o estabelecimento
    const establishment = await prisma.establishment.findUnique({
      where: { id: authResult.establishmentId },
      select: { id: true, name: true, slug: true },
    });

    // Busca as configurações de mensagens automáticas
    const settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: authResult.establishmentId },
    });

    // Busca agendamentos de hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await prisma.appointment.findMany({
      where: {
        establishmentId: authResult.establishmentId,
        date: {
          gte: today,
          lt: tomorrow,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: {
        client: { select: { name: true, phone: true } },
        professional: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    // Busca logs de mensagens recentes
    const recentLogs = await prisma.messageLog.findMany({
      where: { establishmentId: authResult.establishmentId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return success({
      establishment,
      automaticMessageSettings: settings || 'NAO_CONFIGURADO',
      configStatus: {
        hasSettings: !!settings,
        whatsappConnected: settings?.whatsappConnected || false,
        whatsappInstanceName: settings?.whatsappInstanceName || null,
        activeMessages: settings?.activeMessages || [],
      },
      todayAppointments: appointments.map(a => ({
        id: a.id,
        date: a.date,
        startTime: a.startTime,
        status: a.status,
        client: a.client,
        professional: a.professional.name,
        service: a.service.name,
      })),
      recentMessageLogs: recentLogs,
      instructions: !settings ? [
        '1. Acesse a pagina de Mensagens Automaticas no frontend',
        '2. Conecte seu WhatsApp escaneando o QR Code',
        '3. Ative os tipos de mensagem que deseja enviar',
        '4. Teste novamente',
      ] : [],
    });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/debug/automatic-messages - Cria configuração de teste
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) {
      return authResult.response;
    }

    const body = await request.json();
    
    // Busca o estabelecimento para pegar o slug
    const establishment = await prisma.establishment.findUnique({
      where: { id: authResult.establishmentId },
      select: { slug: true },
    });

    if (!establishment) {
      return success({ error: 'Estabelecimento não encontrado' }, 404);
    }

    // Cria ou atualiza as configurações
    const settings = await prisma.automaticMessageSettings.upsert({
      where: { establishmentId: authResult.establishmentId },
      create: {
        establishmentId: authResult.establishmentId,
        activeMessages: body.activeMessages || ['confirmation', 'reminder_24h', 'reminder_1h'],
        whatsappInstanceName: body.instanceName || `ZapFlow-Agenda_${establishment.slug}`,
        whatsappConnected: body.connected ?? true,
        whatsappPhone: body.phone || null,
      },
      update: {
        activeMessages: body.activeMessages || ['confirmation', 'reminder_24h', 'reminder_1h'],
        whatsappInstanceName: body.instanceName || `ZapFlow-Agenda_${establishment.slug}`,
        whatsappConnected: body.connected ?? true,
        whatsappPhone: body.phone || null,
      },
    });

    return success({
      message: 'Configurações criadas/atualizadas com sucesso',
      settings,
    });
  } catch (error) {
    return handleError(error);
  }
}
