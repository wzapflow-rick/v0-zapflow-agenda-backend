import prisma from '../models/prisma';
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AvailableSlotsQuery,
  AppointmentFilters,
} from '../utils/validators';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors';
import { PaginationParams, AvailableSlot, BusinessHours } from '../types';

// Helper para converter string de horário para minutos desde meia-noite
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper para converter minutos desde meia-noite para string de horário
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Helper para obter o dia da semana em inglês
const getDayOfWeek = (date: Date): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

export const appointmentsService = {
  // Criar novo agendamento
  async create(establishmentId: string, data: CreateAppointmentInput) {
    // Busca o serviço para obter duração e preço
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
    });

    if (!service || service.establishmentId !== establishmentId) {
      throw new NotFoundError('Serviço');
    }

    // Verifica se o profissional existe e pertence ao estabelecimento
    const professional = await prisma.professional.findUnique({
      where: { id: data.professionalId },
    });

    if (!professional || professional.establishmentId !== establishmentId) {
      throw new NotFoundError('Profissional');
    }

    // Verifica se o cliente existe e pertence ao estabelecimento
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    });

    if (!client || client.establishmentId !== establishmentId) {
      throw new NotFoundError('Cliente');
    }

    // Calcula horário de término
    const startMinutes = timeToMinutes(data.startTime);
    const endMinutes = startMinutes + service.duration;
    const endTime = minutesToTime(endMinutes);

    // Verifica conflitos de horário
    const hasConflict = await this.checkConflict(
      data.professionalId,
      data.date,
      data.startTime,
      endTime
    );

    if (hasConflict) {
      throw new ConflictError('Já existe um agendamento neste horário para este profissional');
    }

    // Cria o agendamento
    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(data.date),
        startTime: new Date(`1970-01-01T${data.startTime}:00`),
        endTime: new Date(`1970-01-01T${endTime}:00`),
        notes: data.notes,
        price: service.price,
        establishmentId,
        clientId: data.clientId,
        professionalId: data.professionalId,
        serviceId: data.serviceId,
      },
      include: {
        client: {
          select: { id: true, name: true, phone: true, email: true },
        },
        professional: {
          select: { id: true, name: true },
        },
        service: {
          select: { id: true, name: true, duration: true },
        },
      },
    });

    return appointment;
  },

  // Listar agendamentos com filtros
  async list(
    establishmentId: string,
    filters: AppointmentFilters,
    pagination?: PaginationParams
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      establishmentId,
    };

    // Aplica filtros
    if (filters.date) {
      where.date = new Date(filters.date);
    } else if (filters.startDate && filters.endDate) {
      where.date = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    if (filters.professionalId) {
      where.professionalId = filters.professionalId;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true, phone: true, email: true },
          },
          professional: {
            select: { id: true, name: true },
          },
          service: {
            select: { id: true, name: true, duration: true, price: true },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // Obter agendamento por ID
  async getById(appointmentId: string, establishmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: {
          select: { id: true, name: true, phone: true, email: true },
        },
        professional: {
          select: { id: true, name: true },
        },
        service: {
          select: { id: true, name: true, duration: true, price: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento');
    }

    if (appointment.establishmentId !== establishmentId) {
      throw new ForbiddenError('Agendamento não pertence a este estabelecimento');
    }

    return appointment;
  },

  // Atualizar agendamento
  async update(
    appointmentId: string,
    establishmentId: string,
    data: UpdateAppointmentInput
  ) {
    const existing = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        service: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Agendamento');
    }

    if (existing.establishmentId !== establishmentId) {
      throw new ForbiddenError('Agendamento não pertence a este estabelecimento');
    }

    // Se está alterando data ou horário, verifica conflitos
    if (data.date || data.startTime) {
      const date = data.date || existing.date.toISOString().split('T')[0];
      const startTime = data.startTime || existing.startTime.toISOString().split('T')[1].substring(0, 5);
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = startMinutes + existing.service.duration;
      const endTime = minutesToTime(endMinutes);

      const hasConflict = await this.checkConflict(
        existing.professionalId,
        date,
        startTime,
        endTime,
        appointmentId // Exclui o próprio agendamento da verificação
      );

      if (hasConflict) {
        throw new ConflictError('Já existe um agendamento neste horário para este profissional');
      }
    }

    const updateData: any = {};

    if (data.date) {
      updateData.date = new Date(data.date);
    }

    if (data.startTime) {
      const startMinutes = timeToMinutes(data.startTime);
      const endMinutes = startMinutes + existing.service.duration;
      updateData.startTime = new Date(`1970-01-01T${data.startTime}:00`);
      updateData.endTime = new Date(`1970-01-01T${minutesToTime(endMinutes)}:00`);
    }

    if (data.status) {
      updateData.status = data.status;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
      include: {
        client: {
          select: { id: true, name: true, phone: true, email: true },
        },
        professional: {
          select: { id: true, name: true },
        },
        service: {
          select: { id: true, name: true, duration: true, price: true },
        },
      },
    });

    return updated;
  },

  // Cancelar/deletar agendamento
  async delete(appointmentId: string, establishmentId: string) {
    const existing = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!existing) {
      throw new NotFoundError('Agendamento');
    }

    if (existing.establishmentId !== establishmentId) {
      throw new ForbiddenError('Agendamento não pertence a este estabelecimento');
    }

    // Em vez de deletar, marca como cancelado
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });

    return { success: true };
  },

  // Buscar horários disponíveis
  async getAvailableSlots(
    establishmentId: string,
    query: AvailableSlotsQuery
  ): Promise<AvailableSlot[]> {
    const { date, serviceId, professionalId } = query;

    // Busca o estabelecimento para obter horários de funcionamento
    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    // Busca o serviço para obter a duração
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service || service.establishmentId !== establishmentId) {
      throw new NotFoundError('Serviço');
    }

    // Busca os profissionais que podem realizar o serviço
    let professionals = await prisma.professional.findMany({
      where: {
        establishmentId,
        active: true,
        ...(professionalId && { id: professionalId }),
        services: {
          some: {
            serviceId,
          },
        },
      },
    });

    // Se não há relação profissional-serviço, busca todos os profissionais ativos
    if (professionals.length === 0 && !professionalId) {
      professionals = await prisma.professional.findMany({
        where: {
          establishmentId,
          active: true,
        },
      });
    }

    if (professionals.length === 0) {
      return [];
    }

    // Obtém os agendamentos existentes para o dia
    const dateObj = new Date(date);
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        establishmentId,
        date: dateObj,
        professionalId: {
          in: professionals.map((p) => p.id),
        },
        status: {
          notIn: ['CANCELLED'],
        },
      },
      select: {
        professionalId: true,
        startTime: true,
        endTime: true,
      },
    });

    // Gera os slots disponíveis
    const availableSlots: AvailableSlot[] = [];
    const dayOfWeek = getDayOfWeek(dateObj);
    const businessHours = establishment.businessHours as BusinessHours | null;

    // Verifica se o estabelecimento funciona no dia
    if (!businessHours || !businessHours[dayOfWeek]?.enabled) {
      return [];
    }

    const { open, close } = businessHours[dayOfWeek];
    const openMinutes = timeToMinutes(open);
    const closeMinutes = timeToMinutes(close);
    const serviceDuration = service.duration;

    // Para cada profissional, gera os slots disponíveis
    for (const professional of professionals) {
      // Obtém horários de trabalho do profissional (se definidos) ou usa do estabelecimento
      const workingHours = professional.workingHours as BusinessHours | null;
      let profOpenMinutes = openMinutes;
      let profCloseMinutes = closeMinutes;

      if (workingHours && workingHours[dayOfWeek]?.enabled) {
        profOpenMinutes = timeToMinutes(workingHours[dayOfWeek].open);
        profCloseMinutes = timeToMinutes(workingHours[dayOfWeek].close);
      } else if (workingHours && !workingHours[dayOfWeek]?.enabled) {
        // Profissional não trabalha neste dia
        continue;
      }

      // Agendamentos do profissional no dia
      const profAppointments = existingAppointments
        .filter((a) => a.professionalId === professional.id)
        .map((a) => ({
          start: timeToMinutes(a.startTime.toISOString().split('T')[1].substring(0, 5)),
          end: timeToMinutes(a.endTime.toISOString().split('T')[1].substring(0, 5)),
        }))
        .sort((a, b) => a.start - b.start);

      // Gera slots baseado na duração do serviço
      // NOTA: Esta é uma implementação simplificada. Uma versão completa
      // consideraria intervalos entre agendamentos, tempo de limpeza, etc.
      let currentTime = profOpenMinutes;

      while (currentTime + serviceDuration <= profCloseMinutes) {
        const slotStart = currentTime;
        const slotEnd = currentTime + serviceDuration;

        // Verifica se o slot conflita com algum agendamento existente
        const hasConflict = profAppointments.some(
          (appt) => !(slotEnd <= appt.start || slotStart >= appt.end)
        );

        if (!hasConflict) {
          availableSlots.push({
            startTime: minutesToTime(slotStart),
            endTime: minutesToTime(slotEnd),
            professionalId: professional.id,
            professionalName: professional.name,
          });
        }

        // Avança para o próximo slot (usando duração do slot do estabelecimento ou do serviço)
        currentTime += establishment.slotDuration || serviceDuration;
      }
    }

    // Ordena por horário e depois por profissional
    return availableSlots.sort((a, b) => {
      const timeCompare = a.startTime.localeCompare(b.startTime);
      if (timeCompare !== 0) return timeCompare;
      return a.professionalName.localeCompare(b.professionalName);
    });
  },

  // Verifica conflito de horário
  async checkConflict(
    professionalId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string
  ): Promise<boolean> {
    const startDateTime = new Date(`1970-01-01T${startTime}:00`);
    const endDateTime = new Date(`1970-01-01T${endTime}:00`);

    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        professionalId,
        date: new Date(date),
        status: { notIn: ['CANCELLED'] },
        ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
        OR: [
          // Novo agendamento começa durante um existente
          {
            startTime: { lte: startDateTime },
            endTime: { gt: startDateTime },
          },
          // Novo agendamento termina durante um existente
          {
            startTime: { lt: endDateTime },
            endTime: { gte: endDateTime },
          },
          // Novo agendamento engloba um existente
          {
            startTime: { gte: startDateTime },
            endTime: { lte: endDateTime },
          },
        ],
      },
    });

    return !!conflictingAppointment;
  },
};
