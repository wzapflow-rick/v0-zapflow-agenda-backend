import type { BusinessConfiguration } from './types';
import { FEATURES } from './types';

export const clinicConfig: BusinessConfiguration = {
  id: 'CLINIC',
  label: 'Clínica',

  ui: {
    labels: {
      client: 'Paciente',
      professional: 'Profissional',
      appointment: 'Consulta',
      service: 'Procedimento',
      dashboardTitle: 'Painel da Clínica',
    },
    dashboardCards: [
      { id: 'appointments_today', enabled: true, order: 1 },
      { id: 'medical_records', enabled: true, order: 2 },
      { id: 'clients', enabled: true, order: 3 },
      { id: 'revenue', enabled: true, order: 4 },
    ],
  },

  business: {
    defaultServices: [
      { name: 'Consulta Inicial', duration: 50 },
      { name: 'Retorno', duration: 30 },
      { name: 'Avaliação', duration: 60 },
    ],
    features: [FEATURES.MEDICAL_RECORDS],
  },

  whatsappTemplates: {
    reservation_created:
      'Olá {{client}}! Sua consulta com {{professional}} foi reservada para {{date}} às {{time}}. Confirme: {{link}}',
    confirmation_request:
      'Olá {{client}}, confirma sua consulta em {{date}} às {{time}}? {{link}}',
    confirmation_reminder:
      'Lembrete: confirme sua consulta de {{date}} às {{time}}. {{link}}',
    confirmation_cancelled:
      'Sua consulta de {{date}} às {{time}} foi cancelada por falta de confirmação.',
    final_reminder:
      'Lembrete: sua consulta é hoje às {{time}} na {{establishment}}.',
  },
};
