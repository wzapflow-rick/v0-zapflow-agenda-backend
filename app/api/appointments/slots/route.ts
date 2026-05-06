import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ApiError } from '@/lib/api-utils';
import { z } from 'zod';

const slotsQuerySchema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// GET /api/appointments/slots - Obter slots disponíveis
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const { searchParams } = new URL(request.url);
    const query = slotsQuerySchema.parse({
      professionalId: searchParams.get('professionalId'),
      serviceId: searchParams.get('serviceId'),
      date: searchParams.get('date'),
    });

    // Busca estabelecimento
    const establishment = await prisma.establishment.findUnique({
      where: { id: authResult.establishmentId },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    // Busca profissional
    const professional = await prisma.professional.findUnique({
      where: { id: query.professionalId },
    });

    if (!professional || professional.establishmentId !== authResult.establishmentId) {
      throw new NotFoundError('Profissional');
    }

    // Busca serviço
    const service = await prisma.service.findUnique({
      where: { id: query.serviceId },
    });

    if (!service || service.establishmentId !== authResult.establishmentId) {
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

    // Busca agendamentos existentes do dia
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        professionalId: query.professionalId,
        date: new Date(query.date),
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

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
      const slotEndMinutes = currentTime + serviceDuration;
      const slotEnd = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;

      // Verifica se conflita com agendamentos existentes
      const slotStartDate = new Date(`1970-01-01T${slotStart}:00`);
      const slotEndDate = new Date(`1970-01-01T${slotEnd}:00`);

      const hasConflict = existingAppointments.some(apt => {
        const aptStart = new Date(apt.startTime);
        const aptEnd = new Date(apt.endTime);
        return (slotStartDate < aptEnd && slotEndDate > aptStart);
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
