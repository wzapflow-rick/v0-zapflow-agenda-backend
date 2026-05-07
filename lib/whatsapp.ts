import prisma from './prisma';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

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

// Classe para interagir com a Evolution API
export class EvolutionAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = EVOLUTION_API_URL || '';
    this.apiKey = EVOLUTION_API_KEY || '';
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Evolution API não configurada. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY.');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(error.message || `Erro ${response.status}`);
    }

    return response.json();
  }

  // Cria uma nova instância
  async createInstance(instanceName: string) {
    return this.request('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });
  }

  // Obtém o QR Code para conexão
  async getQRCode(instanceName: string) {
    return this.request(`/instance/connect/${instanceName}`, {
      method: 'GET',
    });
  }

  // Verifica o status da conexão
  async getConnectionStatus(instanceName: string) {
    return this.request(`/instance/connectionState/${instanceName}`, {
      method: 'GET',
    });
  }

  // Desconecta e remove a instância
  async deleteInstance(instanceName: string) {
    return this.request(`/instance/delete/${instanceName}`, {
      method: 'DELETE',
    });
  }

  // Faz logout da instância
  async logout(instanceName: string) {
    return this.request(`/instance/logout/${instanceName}`, {
      method: 'DELETE',
    });
  }

  // Obtém informações da instância
  async fetchInstance(instanceName: string) {
    return this.request(`/instance/fetchInstances?instanceName=${instanceName}`, {
      method: 'GET',
    });
  }

  // Envia mensagem de texto
  async sendText(instanceName: string, phone: string, text: string) {
    return this.request(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        number: formatPhoneNumber(phone),
        text,
      }),
    });
  }

  // Obtém status da instância (conectado, QR code, etc)
  async getInstanceStatus(instanceName: string): Promise<{ connected: boolean; qrCode?: string }> {
    try {
      const status = await this.getConnectionStatus(instanceName);
      
      if (status?.state === 'open') {
        return { connected: true };
      }

      // Se não está conectado, tenta pegar o QR code
      try {
        const qrData = await this.getQRCode(instanceName);
        return { connected: false, qrCode: qrData?.base64 || qrData?.qrcode };
      } catch {
        return { connected: false };
      }
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao obter status:', error);
      return { connected: false };
    }
  }
}

// Instância singleton para uso nos endpoints
export const evolutionApi = new EvolutionAPI();

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

Seu agendamento foi confirmado:
📅 {date} às {time}
💇 {serviceName}
👤 Profissional: {professionalName}

Endereço: {address}

Até lá! 🙂`,

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
  console.log(`[v0] canSendMessage - buscando settings para establishmentId: ${establishmentId}`);
  
  const settings = await prisma.automaticMessageSettings.findUnique({
    where: { establishmentId },
  });

  console.log(`[v0] canSendMessage - settings encontrado:`, settings);

  if (!settings) {
    console.log(`[v0] canSendMessage - settings não encontrado`);
    return { canSend: false };
  }

  if (!settings.whatsappConnected || !settings.whatsappInstanceName) {
    console.log(`[v0] canSendMessage - WhatsApp não conectado ou sem instância`);
    return { canSend: false };
  }

  if (!settings.activeMessages.includes(messageType)) {
    console.log(`[v0] canSendMessage - mensagem ${messageType} não está ativa. Ativas: ${settings.activeMessages.join(', ')}`);
    return { canSend: false };
  }

  return { canSend: true, settings: { whatsappInstanceName: settings.whatsappInstanceName } };
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
    await prisma.messageLog.create({
      data: {
        establishmentId: params.establishmentId,
        messageType: params.messageType,
        recipientPhone: params.recipientPhone,
        recipientName: params.recipientName,
        content: params.content,
        status: params.status,
        errorMessage: params.errorMessage,
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
  console.log(`[v0] sendAutomaticMessage chamada - tipo: ${messageType}, estabelecimento: ${appointment.establishment.id}`);
  
  const { canSend, settings } = await canSendMessage(appointment.establishment.id, messageType);
  console.log(`[v0] canSendMessage resultado - canSend: ${canSend}, settings:`, settings);

  if (!canSend || !settings) {
    console.log(`[WhatsApp] Mensagem ${messageType} não será enviada - não ativa ou WhatsApp desconectado`);
    return { success: false, error: 'Mensagem não ativa ou WhatsApp desconectado' };
  }

  const template = MESSAGE_TEMPLATES[messageType];
  if (!template) {
    return { success: false, error: 'Template não encontrado' };
  }

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

  console.log(`[v0] Enviando mensagem para ${appointment.client.phone} via instância ${settings.whatsappInstanceName}`);
  
  const result = await sendToEvolutionAPI(
    settings.whatsappInstanceName,
    appointment.client.phone,
    message
  );
  
  console.log(`[v0] Resultado do envio:`, result);

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
