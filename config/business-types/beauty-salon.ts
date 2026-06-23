import type { BusinessConfiguration } from './types';
import { FEATURES } from './types';

export const beautySalonConfig: BusinessConfiguration = {
  id: 'BEAUTY_SALON',
  label: 'Salão de Beleza',

  ui: {
    labels: {
      client: 'Cliente',
      professional: 'Profissional',
      appointment: 'Agendamento',
      service: 'Serviço',
      dashboardTitle: 'Painel do Salão',
    },
    dashboardCards: [
      { id: 'appointments_today', enabled: true, order: 1 },
      { id: 'revenue', enabled: true, order: 2 },
      { id: 'clients', enabled: true, order: 3 },
      { id: 'products', enabled: true, order: 4 },
    ],
  },

  business: {
    defaultServices: [
      { name: 'Corte Feminino', duration: 60 },
      { name: 'Escova', duration: 45 },
      { name: 'Coloração', duration: 120 },
      { name: 'Manicure', duration: 45 },
      { name: 'Pedicure', duration: 45 },
    ],
    features: [FEATURES.PRODUCTS],
  },

  whatsappTemplates: {
    reservation_created:
      'Olá {{client}}! Seu horário no {{establishment}} foi reservado para {{date}} às {{time}}. Confirme: {{link}}',
    confirmation_request:
      'Olá {{client}}, confirma seu horário em {{date}} às {{time}}? {{link}}',
    confirmation_reminder:
      'Lembrete: confirme seu horário de {{date}} às {{time}}. {{link}}',
    confirmation_cancelled:
      'Seu horário de {{date}} às {{time}} foi cancelado por falta de confirmação.',
    final_reminder:
      'Te esperamos hoje às {{time}} no {{establishment}}! Até logo.',
  },
};
