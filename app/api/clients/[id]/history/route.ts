import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError } from '@/lib/api-utils';
import { NotFoundError, ForbiddenError } from '@/lib/api-utils';

// GET /api/clients/[id]/history - Historico de agendamentos do cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Verifica se o cliente existe e pertence ao estabelecimento
    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundError('Cliente');
    }

    if (client.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    // Busca historico de agendamentos
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: { clientId: id },
        include: {
          professional: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              price: true,
              duration: true,
            },
          },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.appointment.count({
        where: { clientId: id },
      }),
    ]);

    // Calcula estatisticas
    const stats = await prisma.appointment.aggregate({
      where: { 
        clientId: id,
        status: 'COMPLETED',
      },
      _count: true,
      _sum: {
        price: true,
      },
    });

    return success({
      appointments,
      stats: {
        totalAppointments: total,
        completedAppointments: stats._count,
        totalSpent: stats._sum.price || 0,
      },
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
