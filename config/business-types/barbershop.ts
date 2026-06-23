import type { BusinessConfiguration } from './types';
import { FEATURES } from './types';

export const barbershopConfig: BusinessConfiguration = {
  id: 'BARBERSHOP',
  label: 'Barbearia',

  ui: {
    labels: {
      client: 'Cliente',
      professional: 'Barbeiro',
      appointment: 'Agendamento',
      service: 'Serviço',
      dashboardTitle: 'Painel da Barbearia',
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
      { name: 'Corte de Cabelo', duration: 30 },
      { name: 'Barba', duration: 20 },
      { name: 'Corte + Barba', duration: 45 },
      { name: 'Acabamento (Pezinho)', duration: 15 },
    ],
    features: [FEATURES.PRODUCTS],
  },

  whatsappTemplates: {
    reservation_created:
      'Olá {{client}}! Seu horário na {{establishment}} foi reservado para {{date}} às {{time}}. Confirme respondendo este link: {{link}}',
    confirmation_request:
      'Olá {{client}}, confirma seu corte em {{date}} às {{time}}? {{link}}',
    confirmation_reminder:
      'Lembrete: ainda não recebemos sua confirmação para {{date}} às {{time}}. {{link}}',
    confirmation_cancelled:
      'Seu agendamento de {{date}} às {{time}} foi cancelado por falta de confirmação.',
    final_reminder:
      'Te esperamos hoje às {{time}} na {{establishment}}! Até logo.',
  },
};
