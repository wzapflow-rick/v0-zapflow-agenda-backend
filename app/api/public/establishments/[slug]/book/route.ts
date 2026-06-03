import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError, NotFoundError, ApiError } from '@/lib/api-utils';
import { publicBookingSchema } from '@/lib/validators';
import { sendAutomaticMessage } from '@/lib/whatsapp';
import { notifyAppointmentCreated, notifyClientCreated } from '@/lib/notifications';
import { createAppointmentSafe } from '@/lib/booking-lock';
import { 
  generateBookingIdempotencyKey, 
  checkBookingIdempotency, 
  saveBookingIdempotency 
} from '@/lib/idempotency';

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

    // Verificar idempotencia (protege contra double-click)
    const idempotencyKey = generateBookingIdempotencyKey(
      establishment.id,
      data.clientPhone,
      data.date,
      data.startTime
    );
    
    const cachedResult = await checkBookingIdempotency(idempotencyKey);
    if (cachedResult) {
      return success(cachedResult, 201);
    }

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

    let isNewClient = false;
    if (!client) {
      client = await prisma.client.create({
        data: {
          name: data.clientName,
          phone: data.clientPhone,
          email: data.clientEmail,
          establishmentId: establishment.id,
        },
      });
      isNewClient = true;
    }

    // Calcula horário de término
    const startDate = new Date(`${data.date}T${data.startTime}:00`);
    const endDate = new Date(startDate.getTime() + service.duration * 60000);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // Criar agendamento com proteção contra dupla reserva
    const result = await createAppointmentSafe(prisma, {
      date: data.date,
      startTime: data.startTime,
      endTime,
      price: Number(service.price),
      notes: data.notes,
      establishmentId: establishment.id,
      professionalId: data.professionalId,
      serviceId: data.serviceId,
      clientId: client.id,
    });

    if (!result.success) {
      throw new ApiError(result.error, 409);
    }

    const appointment = result.appointment as {
      id: string;
      date: Date;
      startTime: Date;
      endTime: Date;
      status: string;
      professional: { name: string };
      service: { name: string; duration: number; price: number };
    };

    // Formata a data para exibicao
    const dateFormatted = new Date(data.date).toLocaleDateString('pt-BR');

    // Cria notificacao de novo agendamento (nao bloqueia)
    notifyAppointmentCreated({
      establishmentId: establishment.id,
      appointmentId: appointment.id,
      clientName: client.name,
      serviceName: appointment.service.name,
      date: dateFormatted,
      time: data.startTime,
    }).catch((error) => {
      console.error('[Notifications] Erro ao criar notificacao de agendamento:', error);
    });

    // Se for novo cliente, cria notificacao (nao bloqueia)
    if (isNewClient) {
      notifyClientCreated({
        establishmentId: establishment.id,
        clientId: client.id,
        clientName: client.name,
      }).catch((error) => {
        console.error('[Notifications] Erro ao criar notificacao de cliente:', error);
      });
    }

    // Envia mensagem de confirmacao automatica (nao bloqueia a resposta)
    sendAutomaticMessage('confirmation', {
      id: appointment.id,
      date: new Date(data.date),
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
    }).catch((error) => {
      console.error('[WhatsApp] Erro ao enviar mensagem de confirmacao:', error);
    });

    // Preparar resposta
    const responseData = {
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
    };

    // Salvar idempotencia para requests futuros
    await saveBookingIdempotency(idempotencyKey, responseData);

    return success(responseData, 201);
  } catch (error) {
    return handleError(error);
  }
}
