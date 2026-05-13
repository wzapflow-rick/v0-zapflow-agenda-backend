import prisma from './prisma';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Evolution API client
export const evolutionApi = {
  // Obter status da instância
  async getInstanceStatus(instanceName: string): Promise<{ connected: boolean; qrCode?: string }> {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.log('[Evolution API] Variaveis de ambiente nao configuradas');
      return { connected: false };
    }

    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });

      if (!response.ok) {
        console.log('[Evolution API] Response not ok:', response.status);
        return { connected: false };
      }

      const data = await response.json();
      console.log('[Evolution API] Response data:', JSON.stringify(data));
      
      // Evolution API pode retornar o status em diferentes formatos
      const isConnected = 
        data.state === 'open' || 
        data.state === 'connected' ||
        data.instance?.state === 'open' ||
        data.instance?.state === 'connected' ||
        data.status === 'open' ||
        data.status === 'connected';
      
      return {
        connected: isConnected,
        qrCode: data.qrcode?.base64 || data.qr?.base64,
      };
    } catch (error) {
      console.error('[Evolution API] Erro ao obter status:', error);
      return { connected: false };
    }
  },

  // Criar nova instância
  async createInstance(instanceName: string): Promise<{ success: boolean; qrCode?: string }> {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return { success: false };
    }

    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Evolution API] Erro ao criar instância:', errorData);
        return { success: false };
      }

      const data = await response.json();
      return {
        success: true,
        qrCode: data.qrcode?.base64,
      };
    } catch (error) {
      console.error('[Evolution API] Erro ao criar instância:', error);
      return { success: false };
    }
  },

  // Deletar instância
  async deleteInstance(instanceName: string): Promise<{ success: boolean }> {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return { success: false };
    }

    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });

      return { success: response.ok };
    } catch (error) {
      console.error('[Evolution API] Erro ao deletar instância:', error);
      return { success: false };
    }
  },
};

// Tipos de mensagens disponíveis
export type MessageType = 
  | 'confirmation'
  | 'reminder_24h'
  | 'reminder_1h'
  | 'thank_you'
  | 'birthday'
  | 'no_show'
  | 'reactivation'
  | 'cancellation'
  | 'waitlist'
  | 'promotion';

// Interface para variáveis do template
export interface MessageVariables {
  clientName: string;
  clientPhone: string;
  date?: string;
  time?: string;
  serviceName?: string;
  professionalName?: string;
  establishmentName?: string;
  address?: string;
  bookingUrl?: string;
  promotionText?: string;
}

// Templates das mensagens
const MESSAGE_TEMPLATES: Record<MessageType, string> = {
  confirmation: `Olá {clientName}! 👋

Seu agendamento foi *enviado* e os responsáveis foram notificados!

📅 {date} às {time}
💇 {serviceName}
👤 Profissional: {professionalName}
📍 {establishmentName}

Aguarde a confirmação do estabelecimento.`,

  reminder_24h: `Olá {clientName}! 

Lembrete: você tem um agendamento amanhã!
📅 {date} às {time}
💇 {serviceName}

Confirma sua presença? Responda SIM ou NÃO.`,

  reminder_1h: `{clientName}, falta 1 hora para seu horário!

⏰ {time}
📍 {address}

Te esperamos!`,

  thank_you: `Olá {clientName}!

Obrigado pela visita! 😊
Esperamos que tenha gostado do atendimento.

Volte sempre!
{establishmentName}`,

  birthday: `🎂 Feliz Aniversário, {clientName}!

Desejamos um dia incrível!

Como presente, você ganhou 10% de desconto no seu próximo agendamento.

Agende pelo link: {bookingUrl}`,

  no_show: `Olá {clientName},

Sentimos sua falta hoje! 😕
Você tinha um horário agendado às {time}.

Aconteceu algum imprevisto? 
Reagende quando puder: {bookingUrl}`,

  reactivation: `Olá {clientName}! 

Faz tempo que não te vemos por aqui! 😊
Que tal agendar um horário?

Acesse: {bookingUrl}

Te esperamos!`,

  cancellation: `Olá {clientName},

Seu agendamento foi cancelado:
📅 {date} às {time}
💇 {serviceName}

Se precisar reagendar: {bookingUrl}`,

  waitlist: `Boa notícia, {clientName}! 🎉

Abriu uma vaga no horário que você queria!
📅 {date} às {time}

Quer confirmar? Responda SIM para garantir.`,

  promotion: `{clientName}, temos uma novidade! 🔥

{promotionText}

Agende agora: {bookingUrl}`,
};

// Formata o número de telefone para o formato da Evolution API (5511999999999)
function formatPhoneNumber(phone: string): string {
  // Remove tudo que não é número
  const numbers = phone.replace(/\D/g, '');
  
  // Se já começa com 55, retorna como está
  if (numbers.startsWith('55')) {
    return numbers;
  }
  
  // Adiciona o código do país
  return `55${numbers}`;
}

// Formata a data para exibição
function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  return date.toLocaleDateString('pt-BR', options);
}

// Formata o horário para exibição
function formatTime(time: Date | string): string {
  if (typeof time === 'string') {
    return time;
  }
  return time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Substitui as variáveis no template
function replaceVariables(template: string, variables: MessageVariables): string {
  let message = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    if (value) {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
  });
  
  return message;
}

// Envia mensagem via Evolution API
async function sendToEvolutionAPI(
  instanceName: string,
  phone: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('[WhatsApp] Evolution API não configurada');
    return { success: false, error: 'Evolution API não configurada' };
  }

  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: formatPhoneNumber(phone),
        text: text,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[WhatsApp] Erro ao enviar mensagem:', errorData);
      return { success: false, error: errorData.message || 'Erro ao enviar mensagem' };
    }

    return { success: true };
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar mensagem:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// Interface para dados do agendamento
interface AppointmentData {
  id: string;
  date: Date;
  startTime: Date | string;
  client: {
    id: string;
    name: string;
    phone: string;
  };
  professional: {
    name: string;
  };
  service: {
    name: string;
  };
  establishment: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
  };
}

// Verifica se a mensagem está ativa e o WhatsApp conectado
async function canSendMessage(
  establishmentId: string,
  messageType: MessageType
): Promise<{ canSend: boolean; settings?: { whatsappInstanceName: string } }> {
  console.log('[v0] canSendMessage - buscando settings para establishmentId:', establishmentId);
  
  try {
    const settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId },
    });

    console.log('[v0] canSendMessage - settings encontrado:', settings ? 'sim' : 'nao');

    if (!settings) {
      console.log('[v0] canSendMessage - FALHA: settings nao existe para este estabelecimento');
      return { canSend: false };
    }

    console.log('[v0] canSendMessage - whatsappConnected:', settings.whatsappConnected);
    console.log('[v0] canSendMessage - whatsappInstanceName:', settings.whatsappInstanceName);
    console.log('[v0] canSendMessage - activeMessages:', settings.activeMessages);

    if (!settings.whatsappConnected || !settings.whatsappInstanceName) {
      console.log('[v0] canSendMessage - FALHA: WhatsApp nao conectado ou instanceName vazio');
      return { canSend: false };
    }

    if (!settings.activeMessages.includes(messageType)) {
      console.log('[v0] canSendMessage - FALHA: messageType', messageType, 'nao esta em activeMessages');
      return { canSend: false };
    }

    console.log('[v0] canSendMessage - SUCESSO: mensagem pode ser enviada');
    return { canSend: true, settings: { whatsappInstanceName: settings.whatsappInstanceName } };
  } catch (error) {
    console.error('[v0] canSendMessage - ERRO na query:', error);
    return { canSend: false };
  }
}

// Registra o envio da mensagem no log
async function logMessage(params: {
  establishmentId: string;
  messageType: MessageType;
  recipientPhone: string;
  recipientName: string;
  content: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  errorMessage?: string;
  appointmentId?: string;
  clientId?: string;
}) {
  try {
    // Busca o settings do estabelecimento
    const settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId: params.establishmentId },
    });

    if (!settings) {
      console.error('[WhatsApp] Erro ao registrar log: settings nao encontrado');
      return;
    }

    await prisma.messageLog.create({
      data: {
        settingsId: settings.id,
        messageType: params.messageType,
        recipientPhone: params.recipientPhone,
        recipientName: params.recipientName,
        content: params.content,
        status: params.status,
        error: params.errorMessage,
        sentAt: params.status === 'SENT' ? new Date() : null,
        appointmentId: params.appointmentId,
        clientId: params.clientId,
      },
    });
  } catch (error) {
    console.error('[WhatsApp] Erro ao registrar log:', error);
  }
}

// Gera a URL de agendamento público
function getBookingUrl(slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  return `${baseUrl}/agendar/${slug}`;
}

// Função principal para enviar mensagem automática
export async function sendAutomaticMessage(
  messageType: MessageType,
  appointment: AppointmentData,
  extraVariables?: Partial<MessageVariables>
): Promise<{ success: boolean; error?: string }> {
  console.log('[v0] sendAutomaticMessage - INICIO');
  console.log('[v0] sendAutomaticMessage - messageType:', messageType);
  console.log('[v0] sendAutomaticMessage - establishment.id:', appointment.establishment?.id);
  
  const { canSend, settings } = await canSendMessage(appointment.establishment.id, messageType);

  if (!canSend || !settings) {
    console.log(`[WhatsApp] Mensagem ${messageType} não será enviada - não ativa ou WhatsApp desconectado`);
    return { success: false, error: 'Mensagem não ativa ou WhatsApp desconectado' };
  }

  const template = MESSAGE_TEMPLATES[messageType];
  if (!template) {
    console.log('[v0] sendAutomaticMessage - ERRO: template nao encontrado para', messageType);
    return { success: false, error: 'Template não encontrado' };
  }

  console.log('[v0] sendAutomaticMessage - template encontrado');
  console.log('[v0] sendAutomaticMessage - client.phone:', appointment.client?.phone);

  const variables: MessageVariables = {
    clientName: appointment.client.name,
    clientPhone: appointment.client.phone,
    date: formatDate(appointment.date),
    time: formatTime(appointment.startTime),
    serviceName: appointment.service.name,
    professionalName: appointment.professional.name,
    establishmentName: appointment.establishment.name,
    address: appointment.establishment.address || '',
    bookingUrl: getBookingUrl(appointment.establishment.slug),
    ...extraVariables,
  };

  const message = replaceVariables(template, variables);
  console.log('[v0] sendAutomaticMessage - mensagem montada, enviando para Evolution API');
  console.log('[v0] sendAutomaticMessage - instanceName:', settings.whatsappInstanceName);

  const result = await sendToEvolutionAPI(
    settings.whatsappInstanceName,
    appointment.client.phone,
    message
  );

  // Registra no log
  await logMessage({
    establishmentId: appointment.establishment.id,
    messageType,
    recipientPhone: appointment.client.phone,
    recipientName: appointment.client.name,
    content: message,
    status: result.success ? 'SENT' : 'FAILED',
    errorMessage: result.error,
    appointmentId: appointment.id,
    clientId: appointment.client.id,
  });

  return result;
}

// Enviar mensagem para cliente (sem agendamento)
export async function sendMessageToClient(
  messageType: MessageType,
  establishmentId: string,
  client: { id: string; name: string; phone: string },
  establishment: { name: string; slug: string; address: string | null },
  extraVariables?: Partial<MessageVariables>
): Promise<{ success: boolean; error?: string }> {
  const { canSend, settings } = await canSendMessage(establishmentId, messageType);

  if (!canSend || !settings) {
    return { success: false, error: 'Mensagem não ativa ou WhatsApp desconectado' };
  }

  const template = MESSAGE_TEMPLATES[messageType];
  if (!template) {
    return { success: false, error: 'Template não encontrado' };
  }

  const variables: MessageVariables = {
    clientName: client.name,
    clientPhone: client.phone,
    establishmentName: establishment.name,
    bookingUrl: getBookingUrl(establishment.slug),
    address: establishment.address || '',
    ...extraVariables,
  };

  const message = replaceVariables(template, variables);

  const result = await sendToEvolutionAPI(
    settings.whatsappInstanceName,
    client.phone,
    message
  );

  await logMessage({
    establishmentId,
    messageType,
    recipientPhone: client.phone,
    recipientName: client.name,
    content: message,
    status: result.success ? 'SENT' : 'FAILED',
    errorMessage: result.error,
    clientId: client.id,
  });

  return result;
}

// Exporta os tipos de mensagens disponíveis para uso no frontend
export const AVAILABLE_MESSAGE_TYPES: {
  id: MessageType;
  name: string;
  description: string;
  trigger: string;
}[] = [
  {
    id: 'confirmation',
    name: 'Confirmação de Agendamento',
    description: 'Enviada imediatamente após criar um agendamento',
    trigger: 'appointment_created',
  },
  {
    id: 'reminder_24h',
    name: 'Lembrete 24h',
    description: 'Enviada 24 horas antes do agendamento',
    trigger: 'reminder_24h',
  },
  {
    id: 'reminder_1h',
    name: 'Lembrete 1h',
    description: 'Enviada 1 hora antes do agendamento',
    trigger: 'reminder_1h',
  },
  {
    id: 'thank_you',
    name: 'Agradecimento',
    description: 'Enviada quando o atendimento é concluído',
    trigger: 'appointment_completed',
  },
  {
    id: 'birthday',
    name: 'Aniversário',
    description: 'Enviada no dia do aniversário do cliente',
    trigger: 'client_birthday',
  },
  {
    id: 'no_show',
    name: 'Falta',
    description: 'Enviada quando o cliente falta ao agendamento',
    trigger: 'no_show',
  },
  {
    id: 'reactivation',
    name: 'Reativação',
    description: 'Enviada para clientes inativos há 30+ dias',
    trigger: 'client_inactive',
  },
  {
    id: 'cancellation',
    name: 'Cancelamento',
    description: 'Enviada quando um agendamento é cancelado',
    trigger: 'appointment_cancelled',
  },
  {
    id: 'waitlist',
    name: 'Lista de Espera',
    description: 'Enviada quando abre vaga na lista de espera',
    trigger: 'waitlist_available',
  },
  {
    id: 'promotion',
    name: 'Promoção',
    description: 'Enviada manualmente para divulgar promoções',
    trigger: 'promotion',
  },
];
