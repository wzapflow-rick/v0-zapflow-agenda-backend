import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { createClientSchema } from '@/lib/validators';
import { notifyClientCreated } from '@/lib/notifications';

// GET /api/clients - Listar clientes
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
    const search = searchParams.get('search');

    const where = {
      establishmentId: authResult.establishmentId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          _count: {
            select: {
              appointments: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.client.count({ where }),
    ]);

    return success({
      clients,
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

// POST /api/clients - Criar cliente
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    if (!authResult.establishmentId) {
      throw new NotFoundError('Estabelecimento');
    }

    const body = await request.json();
    const data = createClientSchema.parse(body);

    // Verifica se já existe cliente com mesmo telefone
    const existingClient = await prisma.client.findUnique({
      where: {
        phone_establishmentId: {
          phone: data.phone,
          establishmentId: authResult.establishmentId,
        },
      },
    });

    if (existingClient) {
      return success({ error: 'Cliente com este telefone já existe' }, 409);
    }

    const client = await prisma.client.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        establishmentId: authResult.establishmentId,
      },
    });

    // Cria notificacao de novo cliente (nao bloqueia a resposta)
    notifyClientCreated({
      establishmentId: authResult.establishmentId,
      clientId: client.id,
      clientName: client.name,
    }).catch((error) => {
      console.error('[Notifications] Erro ao criar notificacao de cliente:', error);
    });

    return success(client, 201);
  } catch (error) {
    return handleError(error);
  }
}
