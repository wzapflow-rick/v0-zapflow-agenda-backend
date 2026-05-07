import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError, NotFoundError, ApiError } from '@/lib/api-utils';
import { publicBookingSchema } from '@/lib/validators';
import { sendAutomaticMessage } from '@/lib/whatsapp';

// POST /api/public/[slug]/book - Criar agendamento público
export async function POST(
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

    const body = await request.json();
    const data = publicBookingSchema.parse(body);

    // Verifica se profissional existe e pertence ao estabelecimento
    const professional = await prisma.professional.findUnique({
      where: { id: data.professionalId },
    });

    if (!professional || professional.establishmentId !== establishment.id || !professional.active) {
      throw new NotFoundError('Profissional');
    }

    // Verifica se serviço existe e pertence ao estabelecimento
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
    });

    if (!service || service.establishmentId !== establishment.id || !service.active) {
      throw new NotFoundError('Serviço');
    }

    // Busca ou cria cliente
    let client = await prisma.client.findUnique({
      where: {
        phone_establishmentId: {
          phone: data.clientPhone,
          establishmentId: establishment.id,
        },
      },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: data.clientName,
          phone: data.clientPhone,
          email: data.clientEmail,
          establishmentId: establishment.id,
        },
      });
    }

    // Calcula horário de término
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
        establishmentId: establishment.id,
        professionalId: data.professionalId,
        serviceId: data.serviceId,
        clientId: client.id,
      },
      include: {
        professional: {
          select: {
            name: true,
          },
        },
        service: {
          select: {
            name: true,
            duration: true,
            price: true,
          },
        },
      },
    });

    // Envia mensagem de confirmação (async, não bloqueia a resposta)
    sendAutomaticMessage('confirmation', {
      id: appointment.id,
      date: appointment.date,
      startTime: data.startTime,
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
      },
      professional: {
        name: appointment.professional.name,
      },
      service: {
        name: appointment.service.name,
      },
      establishment: {
        id: establishment.id,
        name: establishment.name,
        slug: establishment.slug,
        address: establishment.address,
      },
    }).catch(err => console.error('[WhatsApp] Erro ao enviar confirmação:', err));

    return success({
      appointment: {
        id: appointment.id,
        date: appointment.date,
        startTime: data.startTime,
        endTime,
        status: appointment.status,
        professional: appointment.professional.name,
        service: appointment.service.name,
        duration: appointment.service.duration,
        price: appointment.service.price,
      },
      message: 'Agendamento realizado com sucesso!',
    }, 201);
  } catch (error) {
    return handleError(error);
  }
}
