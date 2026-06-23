import type { BusinessType } from '@prisma/client';
import type { BusinessConfiguration } from './types';
import { barbershopConfig } from './barbershop';
import { personalTrainerConfig } from './personal-trainer';
import { beautySalonConfig } from './beauty-salon';
import { clinicConfig } from './clinic';
import { otherConfig } from './other';

export * from './types';

/**
 * Registry estático de todos os nichos. Congelado para evitar mutação
 * acidental em runtime. Não há tabela no banco — tudo vive em arquivos TS.
 */
const REGISTRY: Readonly<Record<BusinessType, BusinessConfiguration>> = Object.freeze({
  BARBERSHOP: barbershopConfig,
  PERSONAL_TRAINER: personalTrainerConfig,
  BEAUTY_SALON: beautySalonConfig,
  CLINIC: clinicConfig,
  OTHER: otherConfig,
});

/**
 * Resolve a config de um nicho. Função PURA (sem DB, sem cache).
 * Faz fallback para OTHER se o tipo for inválido ou nulo.
 * Segura para serverless — cada instância apenas lê constantes em memória.
 */
export function resolveBusinessConfig(
  type: BusinessType | string | null | undefined
): BusinessConfiguration {
  if (type && type in REGISTRY) {
    return REGISTRY[type as BusinessType];
  }
  return REGISTRY.OTHER;
}

/**
 * Alias semântico para resolveBusinessConfig.
 */
export function getBusinessConfig(type: BusinessType | string | null | undefined): BusinessConfiguration {
  return resolveBusinessConfig(type);
}

/**
 * Retorna todas as configs (para listagens / seletor de nicho no onboarding).
 */
export function getAllBusinessConfigs(): BusinessConfiguration[] {
  return Object.values(REGISTRY);
}

/**
 * Lista resumida [{ id, label }] de todos os nichos.
 */
export function getBusinessTypeOptions(): { id: BusinessType; label: string }[] {
  return getAllBusinessConfigs().map((c) => ({ id: c.id, label: c.label }));
}

/**
 * Valida se uma string é um BusinessType conhecido.
 */
export function isValidBusinessType(type: string | null | undefined): type is BusinessType {
  return !!type && type in REGISTRY;
}

/**
 * Checa se uma config possui uma feature/módulo habilitado.
 * Uso: hasFeature(config, FEATURES.WORKOUTS)
 */
export function hasFeature(config: BusinessConfiguration, feature: string): boolean {
  return config.business.features.includes(feature);
}
