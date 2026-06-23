import type { BusinessType } from '@prisma/client';

/**
 * Constantes de feature centralizadas.
 * Adicionar novos módulos aqui evita strings soltas pelo código.
 * `features` em cada nicho é um array dessas strings (escala sem breaking change).
 */
export const FEATURES = {
  MEMBERSHIPS: 'memberships',
  WORKOUTS: 'workouts',
  MEDICAL_RECORDS: 'medical-records',
  PRODUCTS: 'products',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Card do dashboard com metadados extensíveis.
 * Permite ordenação e ativar/desativar sem quebrar a estrutura.
 */
export interface DashboardCardConfig {
  id: string;
  enabled: boolean;
  order: number;
}

/**
 * Terminologia exibida na UI, específica por nicho.
 */
export interface BusinessLabels {
  client: string; // ex.: "Paciente", "Aluno"
  professional: string; // ex.: "Médico", "Personal"
  appointment: string; // ex.: "Consulta", "Sessão"
  service: string; // ex.: "Procedimento", "Treino"
  dashboardTitle: string; // título da home do dashboard
}

/**
 * Serviço padrão criado no seed do nicho.
 */
export interface DefaultService {
  name: string;
  duration: number; // minutos
}

/**
 * Configuração completa de um nicho.
 * Separa explicitamente a camada visual (ui) da camada de negócio (business),
 * facilitando o consumo pelo frontend e o crescimento futuro.
 */
export interface BusinessConfiguration {
  id: BusinessType;
  label: string;

  ui: {
    labels: BusinessLabels;
    dashboardCards: DashboardCardConfig[];
  };

  business: {
    defaultServices: DefaultService[];
    features: string[]; // ex.: ["products"], ["memberships","workouts"]
  };

  whatsappTemplates: Record<string, string>;
}
