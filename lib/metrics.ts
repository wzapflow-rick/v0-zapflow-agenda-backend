import { redis } from './redis';

// Prefixo das metricas
const METRICS_PREFIX = 'metrics';

// Tipos de metricas
export type MetricName = 
  // Cache
  | 'slots_cache_hit'
  | 'slots_cache_miss'
  | 'slots_cache_stale'
  | 'slots_cache_revalidated'
  // Query performance
  | 'slots_query_duration'
  | 'booking_duration'
  | 'appointment_created'
  // Rate limit
  | 'rate_limit_exceeded'
  // Errors
  | 'error_booking'
  | 'error_whatsapp'
  | 'error_webhook'
  | 'error_auth'
  // WhatsApp
  | 'whatsapp_sent'
  | 'whatsapp_failed'
  // Webhooks
  | 'webhook_received'
  | 'webhook_processed'
  | 'webhook_failed'
  // Business
  | 'booking_completed'
  | 'booking_cancelled'
  | 'trial_started'
  | 'trial_expired'
  | 'subscription_activated';

// Estrutura de uma metrica
interface MetricData {
  count: number;
  sum?: number;
  min?: number;
  max?: number;
  lastUpdated: number;
}

// Obtem a chave da metrica para a hora atual (agrupamento por hora)
function getMetricKey(name: MetricName): string {
  const now = new Date();
  const hourKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
  return `${METRICS_PREFIX}:${name}:${hourKey}`;
}

// Registra uma metrica (contador ou valor)
export async function trackMetric(name: MetricName, value?: number): Promise<void> {
  if (!redis) return;
  try {
    const key = getMetricKey(name);
    
    // Usa pipeline para atomicidade
    const pipeline = redis.pipeline();
    
    // Incrementa contador
    pipeline.hincrby(key, 'count', 1);
    
    if (value !== undefined) {
      // Soma acumulada para calcular media
      pipeline.hincrbyfloat(key, 'sum', value);
      
      // Atualiza min/max (requer script Lua para atomicidade real, mas aproximacao funciona)
      const current = await redis.hgetall<MetricData>(key);
      if (!current?.min || value < current.min) {
        pipeline.hset(key, { min: value });
      }
      if (!current?.max || value > current.max) {
        pipeline.hset(key, { max: value });
      }
    }
    
    // Timestamp da ultima atualizacao
    pipeline.hset(key, { lastUpdated: Date.now() });
    
    // TTL de 7 dias
    pipeline.expire(key, 60 * 60 * 24 * 7);
    
    await pipeline.exec();
  } catch (error) {
    // Nao propaga erro - metricas nao devem quebrar a aplicacao
    console.error('[Metrics] Erro ao registrar metrica:', error);
  }
}

// Obtem metricas de um periodo
export async function getMetrics(
  name: MetricName,
  hoursBack: number = 24
): Promise<{ hourly: Record<string, MetricData>; total: MetricData }> {
  if (!redis) {
    return { hourly: {}, total: { count: 0, lastUpdated: Date.now() } };
  }
  try {
    const hourly: Record<string, MetricData> = {};
    let totalCount = 0;
    let totalSum = 0;
    let totalMin = Infinity;
    let totalMax = -Infinity;

    const now = new Date();
    
    for (let i = 0; i < hoursBack; i++) {
      const date = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
      const key = `${METRICS_PREFIX}:${name}:${hourKey}`;
      
      const data = await redis.hgetall<MetricData>(key);
      
      if (data && data.count) {
        hourly[hourKey] = data;
        totalCount += data.count;
        if (data.sum) totalSum += data.sum;
        if (data.min && data.min < totalMin) totalMin = data.min;
        if (data.max && data.max > totalMax) totalMax = data.max;
      }
    }

    return {
      hourly,
      total: {
        count: totalCount,
        sum: totalSum || undefined,
        min: totalMin === Infinity ? undefined : totalMin,
        max: totalMax === -Infinity ? undefined : totalMax,
        lastUpdated: Date.now(),
      },
    };
  } catch (error) {
    console.error('[Metrics] Erro ao obter metricas:', error);
    return {
      hourly: {},
      total: { count: 0, lastUpdated: Date.now() },
    };
  }
}

// Obtem resumo de todas as metricas
export async function getMetricsSummary(hoursBack: number = 24): Promise<Record<MetricName, MetricData>> {
  const metricNames: MetricName[] = [
    'slots_cache_hit',
    'slots_cache_miss',
    'slots_cache_stale',
    'slots_cache_revalidated',
    'slots_query_duration',
    'booking_duration',
    'appointment_created',
    'rate_limit_exceeded',
    'error_booking',
    'error_whatsapp',
    'error_webhook',
    'error_auth',
    'whatsapp_sent',
    'whatsapp_failed',
    'webhook_received',
    'webhook_processed',
    'webhook_failed',
    'booking_completed',
    'booking_cancelled',
    'trial_started',
    'trial_expired',
    'subscription_activated',
  ];

  const summary: Partial<Record<MetricName, MetricData>> = {};

  await Promise.all(
    metricNames.map(async (name) => {
      const { total } = await getMetrics(name, hoursBack);
      summary[name] = total;
    })
  );

  return summary as Record<MetricName, MetricData>;
}

// Calcula cache hit ratio
export async function getCacheHitRatio(hoursBack: number = 24): Promise<number> {
  const [hits, misses, stale] = await Promise.all([
    getMetrics('slots_cache_hit', hoursBack),
    getMetrics('slots_cache_miss', hoursBack),
    getMetrics('slots_cache_stale', hoursBack),
  ]);

  const total = hits.total.count + misses.total.count + stale.total.count;
  if (total === 0) return 0;

  return ((hits.total.count + stale.total.count) / total) * 100;
}

// Calcula tempo medio de query
export async function getAverageQueryTime(hoursBack: number = 24): Promise<number> {
  const { total } = await getMetrics('slots_query_duration', hoursBack);
  
  if (!total.count || !total.sum) return 0;
  return total.sum / total.count;
}
