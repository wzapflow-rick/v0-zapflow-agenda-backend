import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError, NotFoundError, ApiError } from '@/lib/api-utils';
import { z } from 'zod';

const slotsQuerySchema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// GET /api/public/[slug]/slots - Obter slots disponíveis (público)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
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

    // Busca profissional
    const professional = await prisma.professional.findUnique({
      where: { id: query.professionalId },
    });

    if (!professional || professional.establishmentId !== establishment.id) {
      throw new NotFoundError('Profissional');
    }

    // Busca serviço
    const service = await prisma.service.findUnique({
      where: { id: query.serviceId },
    });

    if (!service || service.establishmentId !== establishment.id) {
      throw new NotFoundError('Serviço');
    }

    // Determina dia da semana
    const date = new Date(query.date);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = days[date.getDay()];

    // Busca horário de funcionamento
    const businessHours = establishment.businessHours as Record<string, { isOpen: boolean; openTime: string; closeTime: string }> | null;
    const professionalHours = professional.workingHours as Record<string, { isOpen: boolean; openTime: string; closeTime: string }> | null;
    
    const hours = professionalHours?.[dayOfWeek] || businessHours?.[dayOfWeek];

    if (!hours || !hours.isOpen) {
      return success({ slots: [], message: 'Estabelecimento fechado neste dia' });
    }

    // Busca agendamentos existentes do dia com duracao do servico
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        professionalId: query.professionalId,
        date: new Date(query.date),
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        startTime: true,
        service: {
          select: { duration: true },
        },
      },
    });

    // Funcao auxiliar para converter "HH:MM" em minutos desde meia-noite
    const parseTime = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    // Gera slots disponíveis
    const slots: string[] = [];
    const slotDuration = establishment.slotDuration;
    const serviceDuration = service.duration;

    const [openHour, openMin] = hours.openTime.split(':').map(Number);
    const [closeHour, closeMin] = hours.closeTime.split(':').map(Number);

    let currentTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    while (currentTime + serviceDuration <= closeTime) {
      const slotStart = `${String(Math.floor(currentTime / 60)).padStart(2, '0')}:${String(currentTime % 60).padStart(2, '0')}`;
      
      // Novo agendamento: inicio e fim em minutos
      const newStart = currentTime;
      const newEnd = currentTime + serviceDuration;

      // Verifica sobreposicao com agendamentos existentes
      const hasConflict = existingAppointments.some(apt => {
        const existingStart = parseTime(apt.startTime);
        const existingEnd = existingStart + apt.service.duration;
        
        // Sobreposicao: novo comeca antes do existente terminar E novo termina depois do existente comecar
        return (newStart < existingEnd) && (newEnd > existingStart);
      });

      if (!hasConflict) {
        slots.push(slotStart);
      }

      currentTime += slotDuration;
    }

    return success({ slots, date: query.date, serviceDuration });
  } catch (error) {
    return handleError(error);
  }
}
