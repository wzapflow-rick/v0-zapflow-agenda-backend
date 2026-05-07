import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ApiError } from '@/lib/api-utils';
import { createAppointmentSchema } from '@/lib/validators';
import { sendAutomaticMessage } from '@/lib/whatsapp';

// GET /api/appointments - Listar agendamentos
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const professionalId = searchParams.get('professionalId');
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = {
      establishmentId: authResult.establishmentId,
    };

    if (status) where.status = status;
    if (professionalId) where.professionalId = professionalId;
    if (clientId) where.clientId = clientId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.date as Record<string, Date>).lte = new Date(endDate);
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          client: true,
          professional: true,
          service: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
      prisma.appointment.count({ where }),
    ]);

    return success({
      appointments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/appointments - Criar agendamento
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const body = await request.json();
    const data = createAppointmentSchema.parse(body);

    // Verifica se profissional existe e pertence ao estabelecimento
    const professional = await prisma.professional.findUnique({
      where: { id: data.professionalId },
    });

    if (!professional || professional.establishmentId !== authResult.establishmentId) {
      throw new NotFoundError('Profissional');
    }

    // Verifica se serviço existe e pertence ao estabelecimento
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
    });

    if (!service || service.establishmentId !== authResult.establishmentId) {
      throw new NotFoundError('Serviço');
    }

    // Verifica se cliente existe e pertence ao estabelecimento
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    });

    if (!client || client.establishmentId !== authResult.establishmentId) {
      throw new NotFoundError('Cliente');
    }

    // Calcula horário de término
    const [hours, minutes] = data.startTime.split(':').map(Number);
    const startDate = new Date(`${data.date}T${data.startTime}:00`);
    const endDate = new Date(startDate.getTime() + service.duration * 60000);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // Verifica conflitos de horário
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        professionalId: data.professionalId,
        date: new Date(data.date),
        status: { notIn: ['CANCELLED'] },
        OR: [
          {
            AND: [
              { startTime: { lte: new Date(`1970-01-01T${data.startTime}:00`) } },
              { endTime: { gt: new Date(`1970-01-01T${data.startTime}:00`) } },
            ],
          },
          {
            AND: [
              { startTime: { lt: new Date(`1970-01-01T${endTime}:00`) } },
              { endTime: { gte: new Date(`1970-01-01T${endTime}:00`) } },
            ],
          },
          {
            AND: [
              { startTime: { gte: new Date(`1970-01-01T${data.startTime}:00`) } },
              { endTime: { lte: new Date(`1970-01-01T${endTime}:00`) } },
            ],
          },
        ],
      },
    });

    if (conflictingAppointment) {
      throw new ApiError('Horário não disponível - conflito com outro agendamento', 409);
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(data.date),
        startTime: new Date(`1970-01-01T${data.startTime}:00`),
        endTime: new Date(`1970-01-01T${endTime}:00`),
        price: service.price,
        notes: data.notes,
        establishmentId: authResult.establishmentId,
        professionalId: data.professionalId,
        serviceId: data.serviceId,
        clientId: data.clientId,
      },
      include: {
        client: true,
        professional: true,
        service: true,
        establishment: {
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
          },
        },
      },
    });

    // Envia mensagem de confirmação (async, não bloqueia a resposta)
    sendAutomaticMessage('confirmation', {
      id: appointment.id,
      date: appointment.date,
      startTime: data.startTime,
      client: appointment.client,
      professional: appointment.professional,
      service: appointment.service,
      establishment: appointment.establishment,
    }).catch(err => console.error('[WhatsApp] Erro ao enviar confirmação:', err));

    return success(appointment, 201);
  } catch (error) {
    return handleError(error);
  }
}
