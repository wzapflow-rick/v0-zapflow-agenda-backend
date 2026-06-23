import prisma from '@/lib/prisma';
import {
  resolveBusinessConfig,
  hasFeature as hasFeaturePure,
  type BusinessConfiguration,
} from '@/config/business-types';

/**
 * Config de nicho resolvida para um estabelecimento específico,
 * já incluindo o metadata livre persistido no banco.
 */
export interface ResolvedBusinessConfig extends BusinessConfiguration {
  metadata: Record<string, unknown> | null;
}

/**
 * Retorna a configuração de nicho de um estabelecimento.
 *
 * IMPORTANTE (serverless): NÃO usamos cache local em memória (Map), pois
 * cada instância da Vercel tem memória própria e o cache ficaria
 * inconsistente entre instâncias. Consultamos o banco diretamente.
 *
 * Evolução futura: quando a camada Redis estiver disponível, este é o
 * ponto para adicionar um cache distribuído (get/set com TTL curto).
 */
export async function getCurrentBusinessConfig(
  establishmentId: string
): Promise<ResolvedBusinessConfig> {
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { businessType: true, metadata: true },
  });

  const config = resolveBusinessConfig(establishment?.businessType);

  return {
    ...config,
    metadata: (establishment?.metadata as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Checa se uma config (resolvida ou estática) possui um módulo/feature.
 * Uso: if (hasFeature(config, FEATURES.WORKOUTS)) { ... }
 */
export function hasFeature(config: BusinessConfiguration, feature: string): boolean {
  return hasFeaturePure(config, feature);
}
