import { describe, it, expect } from 'vitest';
import {
  resolveBusinessConfig,
  getBusinessConfig,
  getAllBusinessConfigs,
  getBusinessTypeOptions,
  isValidBusinessType,
  hasFeature,
  FEATURES,
} from './index';

describe('business-types registry', () => {
  it('resolve retorna a config correta para cada nicho', () => {
    expect(resolveBusinessConfig('BARBERSHOP').id).toBe('BARBERSHOP');
    expect(resolveBusinessConfig('PERSONAL_TRAINER').id).toBe('PERSONAL_TRAINER');
    expect(resolveBusinessConfig('BEAUTY_SALON').id).toBe('BEAUTY_SALON');
    expect(resolveBusinessConfig('CLINIC').id).toBe('CLINIC');
    expect(resolveBusinessConfig('OTHER').id).toBe('OTHER');
  });

  it('faz fallback para OTHER em tipo inválido, nulo ou indefinido', () => {
    expect(resolveBusinessConfig('NAO_EXISTE').id).toBe('OTHER');
    expect(resolveBusinessConfig(null).id).toBe('OTHER');
    expect(resolveBusinessConfig(undefined).id).toBe('OTHER');
    expect(getBusinessConfig('').id).toBe('OTHER');
  });

  it('todas as configs implementam a interface (ui + business)', () => {
    for (const config of getAllBusinessConfigs()) {
      expect(typeof config.id).toBe('string');
      expect(typeof config.label).toBe('string');

      // ui.labels
      expect(config.ui.labels).toMatchObject({
        client: expect.any(String),
        professional: expect.any(String),
        appointment: expect.any(String),
        service: expect.any(String),
        dashboardTitle: expect.any(String),
      });

      // ui.dashboardCards com id/enabled/order
      expect(Array.isArray(config.ui.dashboardCards)).toBe(true);
      for (const card of config.ui.dashboardCards) {
        expect(typeof card.id).toBe('string');
        expect(typeof card.enabled).toBe('boolean');
        expect(typeof card.order).toBe('number');
      }

      // business
      expect(Array.isArray(config.business.features)).toBe(true);
      expect(Array.isArray(config.business.defaultServices)).toBe(true);
      expect(config.whatsappTemplates).toBeTypeOf('object');
    }
  });

  it('isValidBusinessType aceita válidos e rejeita inválidos', () => {
    expect(isValidBusinessType('CLINIC')).toBe(true);
    expect(isValidBusinessType('OTHER')).toBe(true);
    expect(isValidBusinessType('xpto')).toBe(false);
    expect(isValidBusinessType(null)).toBe(false);
    expect(isValidBusinessType(undefined)).toBe(false);
  });

  it('hasFeature reflete os módulos de cada nicho', () => {
    expect(hasFeature(getBusinessConfig('BARBERSHOP'), FEATURES.PRODUCTS)).toBe(true);
    expect(hasFeature(getBusinessConfig('BARBERSHOP'), FEATURES.WORKOUTS)).toBe(false);

    expect(hasFeature(getBusinessConfig('PERSONAL_TRAINER'), FEATURES.WORKOUTS)).toBe(true);
    expect(hasFeature(getBusinessConfig('PERSONAL_TRAINER'), FEATURES.MEMBERSHIPS)).toBe(true);

    expect(hasFeature(getBusinessConfig('CLINIC'), FEATURES.MEDICAL_RECORDS)).toBe(true);
    expect(hasFeature(getBusinessConfig('OTHER'), FEATURES.PRODUCTS)).toBe(false);
  });

  it('getBusinessTypeOptions retorna id + label de todos os nichos', () => {
    const options = getBusinessTypeOptions();
    expect(options).toHaveLength(5);
    expect(options.every((o) => o.id && o.label)).toBe(true);
  });
});
