import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError } from '@/lib/api-utils';

// POST /api/webhooks/evolution - Webhook da Evolution API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[Evolution Webhook] Evento recebido:', body.event, body.instance);

    const { event, instance, data } = body;

    if (!instance) {
      return success({ received: true });
    }

    // Extrai o slug do nome da instância (formato: ZapFlow-Agenda_slug)
    const instanceName = instance;
    
    // Busca as configurações pelo nome da instância
    const settings = await prisma.automaticMessageSettings.findFirst({
      where: { whatsappInstanceName: instanceName },
    });

    if (!settings) {
      console.log('[Evolution Webhook] Instância não encontrada:', instanceName);
      return success({ received: true });
    }

    // Processa eventos de conexão
    switch (event) {
      case 'connection.update': {
        const state = data?.state || data?.status;
        
        if (state === 'open' || state === 'connected') {
          // WhatsApp conectado
          const phoneNumber = data?.phoneNumber || data?.wid?.user || data?.jid?.split('@')[0];
          
          await prisma.automaticMessageSettings.update({
            where: { id: settings.id },
            data: {
              whatsappConnected: true,
              whatsappPhone: phoneNumber || settings.whatsappPhone,
            },
          });
          
          console.log('[Evolution Webhook] WhatsApp conectado:', phoneNumber);
        } else if (state === 'close' || state === 'disconnected') {
          // WhatsApp desconectado
          await prisma.automaticMessageSettings.update({
            where: { id: settings.id },
            data: {
              whatsappConnected: false,
            },
          });
          
          console.log('[Evolution Webhook] WhatsApp desconectado');
        }
        break;
      }

      case 'qrcode.updated': {
        // QR Code atualizado - não precisa fazer nada, o frontend vai buscar
        console.log('[Evolution Webhook] QR Code atualizado');
        break;
      }

      case 'messages.upsert': {
        // Mensagem recebida - pode ser usado para confirmações automáticas
        // Por exemplo: se cliente responde "SIM" ao lembrete
        const message = data?.message;
        const fromMe = message?.key?.fromMe;
        
        if (!fromMe && message?.message?.conversation) {
          const text = message.message.conversation.toLowerCase().trim();
          const remoteJid = message.key.remoteJid;
          const phone = remoteJid?.split('@')[0];
          
          // Verifica se é uma resposta de confirmação
          if (text === 'sim' || text === 's' || text === 'confirmo') {
            console.log('[Evolution Webhook] Confirmação recebida de:', phone);
            // Aqui você pode implementar a lógica de confirmação automática
            // Por exemplo, atualizar o status do agendamento para CONFIRMED
          }
        }
        break;
      }

      default:
        console.log('[Evolution Webhook] Evento não tratado:', event);
    }

    return success({ received: true });
  } catch (error) {
    console.error('[Evolution Webhook] Erro:', error);
    return handleError(error);
  }
}

// GET para verificação do webhook
export async function GET() {
  return success({ status: 'Webhook Evolution API ativo' });
}
