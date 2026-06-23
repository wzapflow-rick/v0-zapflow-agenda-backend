import type { BusinessConfiguration } from './types';
import { FEATURES } from './types';

export const personalTrainerConfig: BusinessConfiguration = {
  id: 'PERSONAL_TRAINER',
  label: 'Personal Trainer',

  ui: {
    labels: {
      client: 'Aluno',
      professional: 'Personal',
      appointment: 'Sessão',
      service: 'Treino',
      dashboardTitle: 'Painel do Personal',
    },
    dashboardCards: [
      { id: 'appointments_today', enabled: true, order: 1 },
      { id: 'memberships', enabled: true, order: 2 },
      { id: 'workouts', enabled: true, order: 3 },
      { id: 'clients', enabled: true, order: 4 },
    ],
  },

  business: {
    defaultServices: [
      { name: 'Avaliação Física', duration: 60 },
      { name: 'Sessão de Treino', duration: 60 },
      { name: 'Treino Funcional', duration: 45 },
      { name: 'Consultoria Online', duration: 30 },
    ],
    features: [FEATURES.MEMBERSHIPS, FEATURES.WORKOUTS],
  },

  whatsappTemplates: {
    reservation_created:
      'Olá {{client}}! Sua sessão com {{professional}} foi reservada para {{date}} às {{time}}. Confirme: {{link}}',
    confirmation_request:
      'Olá {{client}}, confirma sua sessão em {{date}} às {{time}}? {{link}}',
    confirmation_reminder:
      'Lembrete: confirme sua sessão de {{date}} às {{time}}. {{link}}',
    confirmation_cancelled:
      'Sua sessão de {{date}} às {{time}} foi cancelada por falta de confirmação.',
    final_reminder:
      'Bora treinar! Te espero hoje às {{time}}. Não esqueça a água e a toalha.',
  },
};
