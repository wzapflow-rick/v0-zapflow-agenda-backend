import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { z } from 'zod';
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit-redis';
import { redis } from '@/lib/redis';
import { trackMetric } from '@/lib/metrics';

const slotsQuerySchema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Cache config
const CACHE_TTL = 30; // 30 segundos
const STALE_TTL = 60; // 60 segundos para stale-while-revalidate
const LOCK_TTL = 5; // 5 segundos para lock de revalidacao

// Gera chave do cache
function getCacheKey(establishmentId: string, professionalId: string, serviceId: string, date: string) {
  return `slots:${establishmentId}:${professionalId}:${serviceId}:${date}`;
}

// GET /api/public/[slug]/slots - Obter slots disponíveis (público)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const startTime = Date.now();
  
  try {
    // Rate limit por IP
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit('slots', clientIP);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit.reset);
    }

    const { slug } = await params;

    const establishment = await prisma.establishment.findUnique({
      where: { slug },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    const { searchParams } = new URL(request.url);
    const query = slotsQuerySchema.parse({
      professionalId: searchParams.get('professionalId'),
      serviceId: searchParams.get('serviceId'),
      date: searchParams.get('date'),
    });

    const cacheKey = getCacheKey(establishment.id, query.professionalId, query.serviceId, query.date);

    // Tenta buscar do cache (apenas se o Redis estiver configurado)
    try {
      const cached = redis ? await redis.get<{ slots: string[]; date: string; serviceDuration: number; timestamp: number }>(cacheKey) : null;
      
      if (cached) {
        const age = Date.now() - cached.timestamp;
        
        // Cache fresco (< TTL)
        if (age < CACHE_TTL * 1000) {
          await trackMetric('slots_cache_hit');
          return success({ 
            slots: cached.slots, 
            date: cached.date, 
            serviceDuration: cached.serviceDuration,
            cached: true,
          });
        }
        
        // Cache stale mas ainda valido - retorna stale e revalida em background
        if (age < STALE_TTL * 1000) {
          await trackMetric('slots_cache_stale');
          
          // Tenta adquirir lock para revalidacao (evita cache stampede)
          const lockKey = `${cacheKey}:lock`;
          const acquired = redis ? await redis.set(lockKey, '1', { nx: true, ex: LOCK_TTL }) : null;
          
          if (acquired) {
            // Revalida em background (nao bloqueia resposta)
            revalidateSlots(cacheKey, establishment.id, query.professionalId, query.serviceId, query.date).catch(() => {});
          }
          
          return success({ 
            slots: cached.slots, 
            date: cached.date, 
            serviceDuration: cached.serviceDuration,
            cached: true,
            stale: true,
          });
        }
      }
    } catch (cacheError) {
      console.error('[Cache] Erro ao buscar cache:', cacheError);
      // Continua sem cache
    }

    await trackMetric('slots_cache_miss');

    // Busca dados frescos
    const result = await fetchFreshSlots(establishment.id, query.professionalId, query.serviceId, query.date);
    
    // Salva no cache (nao bloqueia resposta)
    try {
      if (redis) {
        await redis.set(cacheKey, { ...result, timestamp: Date.now() }, { ex: STALE_TTL });
      }
    } catch (cacheError) {
      console.error('[Cache] Erro ao salvar cache:', cacheError);
    }

    // Metricas
    const duration = Date.now() - startTime;
    await trackMetric('slots_query_duration', duration);

    return success(result);
  } catch (error) {
    return handleError(error);
  }
}

// Funcao para buscar slots frescos do banco
async function fetchFreshSlots(
  establishmentId: string,
  professionalId: string,
  serviceId: string,
  date: string
): Promise<{ slots: string[]; date: string; serviceDuration: number }> {
  // Busca profissional
  const professional = await prisma.professional.findUnique({
    where: { id: professionalId },
  });

  if (!professional || professional.establishmentId !== establishmentId) {
    throw new NotFoundError('Profissional');
  }

  // Busca servico
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service || service.establishmentId !== establishmentId) {
    throw new NotFoundError('Servico');
  }

  // Busca estabelecimento para horarios
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
  });

  if (!establishment) {
    throw new NotFoundError('Estabelecimento');
  }

  // Determina dia da semana
  const dateObj = new Date(date);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[dateObj.getDay()];

  // Busca horario de funcionamento
  const businessHours = establishment.businessHours as Record<string, { isOpen: boolean; openTime: string; closeTime: string }> | null;
  const professionalHours = professional.workingHours as Record<string, { isOpen: boolean; openTime: string; closeTime: string }> | null;
  
  const hours = professionalHours?.[dayOfWeek] || businessHours?.[dayOfWeek];

  if (!hours || !hours.isOpen) {
    return { slots: [], date, serviceDuration: service.duration };
  }

  // Busca agendamentos existentes do dia
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      professionalId,
      date: new Date(date),
      status: { notIn: ['CANCELLED'] },
    },
    select: {
      startTime: true,
      service: {
        select: { duration: true },
      },
    },
  });

  // Funcao auxiliar para converter horario em minutos
  const parseTime = (time: string | Date): number => {
    if (time instanceof Date) {
      return time.getHours() * 60 + time.getMinutes();
    }
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // Gera slots disponiveis
  const slots: string[] = [];
  const serviceDuration = service.duration;

  const [openHour, openMin] = hours.openTime.split(':').map(Number);
  const [closeHour, closeMin] = hours.closeTime.split(':').map(Number);

  let currentTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;

  while (currentTime + serviceDuration <= closeTime) {
    const slotStart = `${String(Math.floor(currentTime / 60)).padStart(2, '0')}:${String(currentTime % 60).padStart(2, '0')}`;
    
    const newStart = currentTime;
    const newEnd = currentTime + serviceDuration;

    const hasConflict = existingAppointments.some(apt => {
      const existingStart = parseTime(apt.startTime);
      const existingEnd = existingStart + apt.service.duration;
      return (newStart < existingEnd) && (newEnd > existingStart);
    });

    if (!hasConflict) {
      slots.push(slotStart);
    }

    currentTime += serviceDuration;
  }

  return { slots, date, serviceDuration };
}

// Funcao para revalidar cache em background
async function revalidateSlots(
  cacheKey: string,
  establishmentId: string,
  professionalId: string,
  serviceId: string,
  date: string
) {
  if (!redis) return;
  try {
    const result = await fetchFreshSlots(establishmentId, professionalId, serviceId, date);
    await redis.set(cacheKey, { ...result, timestamp: Date.now() }, { ex: STALE_TTL });
    await trackMetric('slots_cache_revalidated');
  } catch (error) {
    console.error('[Cache] Erro ao revalidar:', error);
  } finally {
    // Libera lock
    await redis.del(`${cacheKey}:lock`);
  }
}
