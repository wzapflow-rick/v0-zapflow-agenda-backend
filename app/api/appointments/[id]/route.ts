import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { updateAppointmentSchema } from '@/lib/validators';

// GET /api/appointments/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        professional: true,
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento');
    }

    if (appointment.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    return success(appointment);
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/appointments/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;
    const body = await request.json();
    const data = updateAppointmentSchema.parse(body);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento');
    }

    if (appointment.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: data.status,
        notes: data.notes,
      },
      include: {
        client: true,
        professional: true,
        service: true,
      },
    });

    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/appointments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento');
    }

    if (appointment.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    await prisma.appointment.delete({ where: { id } });

    return success({ message: 'Agendamento excluído com sucesso' });
  } catch (error) {
    return handleError(error);
  }
}
