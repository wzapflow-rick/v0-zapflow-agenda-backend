import type { BusinessConfiguration } from './types';

/**
 * Nicho padrão / genérico. Usado como fallback e para estabelecimentos
 * existentes (default OTHER). Sem serviços padrão e sem módulos exclusivos.
 */
export const otherConfig: BusinessConfiguration = {
  id: 'OTHER',
  label: 'Outro',

  ui: {
    labels: {
      client: 'Cliente',
      professional: 'Profissional',
      appointment: 'Agendamento',
      service: 'Serviço',
      dashboardTitle: 'Painel',
    },
    dashboardCards: [
      { id: 'appointments_today', enabled: true, order: 1 },
      { id: 'revenue', enabled: true, order: 2 },
      { id: 'clients', enabled: true, order: 3 },
    ],
  },

  business: {
    defaultServices: [],
    features: [],
  },

  whatsappTemplates: {
    reservation_created:
      'Olá {{client}}! Seu agendamento na {{establishment}} foi reservado para {{date}} às {{time}}. Confirme: {{link}}',
    confirmation_request:
      'Olá {{client}}, confirma seu agendamento em {{date}} às {{time}}? {{link}}',
    confirmation_reminder:
      'Lembrete: confirme seu agendamento de {{date}} às {{time}}. {{link}}',
    confirmation_cancelled:
      'Seu agendamento de {{date}} às {{time}} foi cancelado por falta de confirmação.',
    final_reminder:
      'Lembrete: seu agendamento é hoje às {{time}} na {{establishment}}.',
  },
};
