import prisma from '../models/prisma';
import { CreateClientInput, UpdateClientInput } from '../utils/validators';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors';
import { PaginationParams } from '../types';

export const clientsService = {
  // Criar novo cliente
  async create(establishmentId: string, data: CreateClientInput) {
    // Verifica se já existe cliente com mesmo telefone no estabelecimento
    const existing = await prisma.client.findUnique({
      where: {
        phone_establishmentId: {
          phone: data.phone,
          establishmentId,
        },
      },
    });

    if (existing) {
      throw new ConflictError('Já existe um cliente cadastrado com este telefone');
    }

    const client = await prisma.client.create({
      data: {
        ...data,
        establishmentId,
      },
    });

    return client;
  },

  // Listar clientes do estabelecimento
  async list(establishmentId: string, pagination?: PaginationParams, search?: string) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      establishmentId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
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
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    return {
      data: clients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // Obter cliente por ID
  async getById(clientId: string, establishmentId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        appointments: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
              },
            },
            professional: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            appointments: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundError('Cliente');
    }

    if (client.establishmentId !== establishmentId) {
      throw new ForbiddenError('Cliente não pertence a este estabelecimento');
    }

    return client;
  },

  // Atualizar cliente
  async update(clientId: string, establishmentId: string, data: UpdateClientInput) {
    const existing = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!existing) {
      throw new NotFoundError('Cliente');
    }

    if (existing.establishmentId !== establishmentId) {
      throw new ForbiddenError('Cliente não pertence a este estabelecimento');
    }

    // Se o telefone está sendo alterado, verifica duplicidade
    if (data.phone && data.phone !== existing.phone) {
      const duplicate = await prisma.client.findUnique({
        where: {
          phone_establishmentId: {
            phone: data.phone,
            establishmentId,
          },
        },
      });

      if (duplicate) {
        throw new ConflictError('Já existe um cliente cadastrado com este telefone');
      }
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data,
    });

    return updated;
  },

  // Deletar cliente
  async delete(clientId: string, establishmentId: string) {
    const existing = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!existing) {
      throw new NotFoundError('Cliente');
    }

    if (existing.establishmentId !== establishmentId) {
      throw new ForbiddenError('Cliente não pertence a este estabelecimento');
    }

    await prisma.client.delete({
      where: { id: clientId },
    });

    return { success: true };
  },

  // Buscar ou criar cliente (usado no agendamento público)
  async findOrCreate(establishmentId: string, data: { name: string; email?: string; phone: string }) {
    const existing = await prisma.client.findUnique({
      where: {
        phone_establishmentId: {
          phone: data.phone,
          establishmentId,
        },
      },
    });

    if (existing) {
      // Atualiza o nome e email se fornecidos
      return prisma.client.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          email: data.email || existing.email,
        },
      });
    }

    return prisma.client.create({
      data: {
        ...data,
        establishmentId,
      },
    });
  },
};
