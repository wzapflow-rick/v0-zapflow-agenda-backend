import type { BusinessType, Prisma } from '@prisma/client';
import { resolveBusinessConfig } from '@/config/business-types';

/**
 * Monta a lista de serviços padrão (sem persistir) para um nicho.
 * Exposto separadamente para facilitar testes unitários.
 * `price` entra como 0 (o dono ajusta depois) — Service.price é obrigatório.
 */
export function buildDefaultServices(
  establishmentId: string,
  businessType: BusinessType | string | null | undefined
): Prisma.ServiceCreateManyInput[] {
  const config = resolveBusinessConfig(businessType);
  return config.business.defaultServices.map((s) => ({
    name: s.name,
    duration: s.duration,
    price: 0,
    establishmentId,
  }));
}

/**
 * Cria os serviços padrão do nicho para um estabelecimento.
 *
 * Regras de segurança:
 * - Não roda para OTHER (lista vazia).
 * - Só cria se o estabelecimento ainda não tiver serviços (evita duplicar).
 * - Nunca lança erro para fora: falha no seed não pode quebrar o registro.
 *
 * Recebe um `client` (PrismaClient ou tx) para flexibilidade.
 */
export async function seedDefaultServices(
  client: {
    service: {
      count: (args: { where: { establishmentId: string } }) => Promise<number>;
      createMany: (args: { data: Prisma.ServiceCreateManyInput[] }) => Promise<{ count: number }>;
    };
  },
  establishmentId: string,
  businessType: BusinessType | string | null | undefined
): Promise<number> {
  try {
    const services = buildDefaultServices(establishmentId, businessType);
    if (services.length === 0) return 0;

    const existingCount = await client.service.count({
      where: { establishmentId },
    });
    if (existingCount > 0) return 0;

    const result = await client.service.createMany({ data: services });
    return result.count;
  } catch (error) {
    console.error('[BusinessSeed] Falha ao criar serviços padrão (ignorado):', error);
    return 0;
  }
}
