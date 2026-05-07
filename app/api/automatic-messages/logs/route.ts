import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';

// GET /api/automatic-messages/logs - Listar logs de mensagens enviadas
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const messageType = searchParams.get('messageType');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = {
      establishmentId: authResult.establishmentId,
    };

    if (messageType) where.messageType = messageType;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.messageLog.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true, phone: true },
          },
          appointment: {
            select: { 
              id: true, 
              date: true, 
              startTime: true,
              service: { select: { name: true } },
              professional: { select: { name: true } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.messageLog.count({ where }),
    ]);

    // Estatísticas
    const stats = await prisma.messageLog.groupBy({
      by: ['status'],
      where: { establishmentId: authResult.establishmentId },
      _count: true,
    });

    const statsMap = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
    };

    stats.forEach(s => {
      statsMap.total += s._count;
      if (s.status === 'SENT' || s.status === 'DELIVERED') statsMap.sent += s._count;
      else if (s.status === 'FAILED') statsMap.failed += s._count;
      else if (s.status === 'PENDING') statsMap.pending += s._count;
    });

    return success({
      logs,
      stats: statsMap,
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
