import { describe, it, expect, vi } from 'vitest';
import { buildDefaultServices, seedDefaultServices } from './business-seed';

describe('buildDefaultServices', () => {
  it('gera serviços com price 0 e establishmentId para um nicho', () => {
    const services = buildDefaultServices('est-1', 'BARBERSHOP');
    expect(services.length).toBeGreaterThan(0);
    for (const s of services) {
      expect(s.establishmentId).toBe('est-1');
      expect(s.price).toBe(0);
      expect(typeof s.name).toBe('string');
      expect(typeof s.duration).toBe('number');
    }
  });

  it('retorna lista vazia para OTHER e tipos inválidos', () => {
    expect(buildDefaultServices('est-1', 'OTHER')).toHaveLength(0);
    expect(buildDefaultServices('est-1', 'invalido')).toHaveLength(0);
    expect(buildDefaultServices('est-1', null)).toHaveLength(0);
  });
});

describe('seedDefaultServices', () => {
  function mockClient(existingCount: number) {
    return {
      service: {
        count: vi.fn().mockResolvedValue(existingCount),
        createMany: vi.fn().mockImplementation(async ({ data }) => ({ count: data.length })),
      },
    };
  }

  it('cria os serviços quando não há serviços existentes', async () => {
    const client = mockClient(0);
    const created = await seedDefaultServices(client, 'est-1', 'CLINIC');
    expect(created).toBeGreaterThan(0);
    expect(client.service.createMany).toHaveBeenCalledOnce();
  });

  it('não cria nada se já existem serviços (evita duplicar)', async () => {
    const client = mockClient(3);
    const created = await seedDefaultServices(client, 'est-1', 'CLINIC');
    expect(created).toBe(0);
    expect(client.service.createMany).not.toHaveBeenCalled();
  });

  it('não cria nada para OTHER (lista vazia) sem nem consultar count', async () => {
    const client = mockClient(0);
    const created = await seedDefaultServices(client, 'est-1', 'OTHER');
    expect(created).toBe(0);
    expect(client.service.count).not.toHaveBeenCalled();
    expect(client.service.createMany).not.toHaveBeenCalled();
  });

  it('nunca lança erro: falha no banco retorna 0', async () => {
    const client = {
      service: {
        count: vi.fn().mockRejectedValue(new Error('db down')),
        createMany: vi.fn(),
      },
    };
    const created = await seedDefaultServices(client, 'est-1', 'BARBERSHOP');
    expect(created).toBe(0);
  });
});
