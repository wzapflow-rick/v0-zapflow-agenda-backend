import prisma from '../models/prisma';
import { CreateServiceInput, UpdateServiceInput } from '../utils/validators';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { PaginationParams } from '../types';

export const servicesService = {
  // Criar novo serviço
  async create(establishmentId: string, data: CreateServiceInput) {
    const { professionalIds, ...serviceData } = data;

    const service = await prisma.service.create({
      data: {
        ...serviceData,
        establishmentId,
        // Associa aos profissionais se fornecidos
        professionals: professionalIds?.length
          ? {
              create: professionalIds.map((professionalId) => ({
                professionalId,
              })),
            }
          : undefined,
      },
      include: {
        professionals: {
          include: {
            professional: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return service;
  },

  // Listar serviços do estabelecimento
  async list(establishmentId: string, pagination?: PaginationParams) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where: { establishmentId },
        include: {
          professionals: {
            include: {
              professional: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
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
      prisma.service.count({ where: { establishmentId } }),
    ]);

    return {
      data: services,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // Obter serviço por ID
  async getById(serviceId: string, establishmentId: string) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        professionals: {
          include: {
            professional: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            appointments: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundError('Serviço');
    }

    if (service.establishmentId !== establishmentId) {
      throw new ForbiddenError('Serviço não pertence a este estabelecimento');
    }

    return service;
  },

  // Atualizar serviço
  async update(serviceId: string, establishmentId: string, data: UpdateServiceInput) {
    const existing = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!existing) {
      throw new NotFoundError('Serviço');
    }

    if (existing.establishmentId !== establishmentId) {
      throw new ForbiddenError('Serviço não pertence a este estabelecimento');
    }

    const { professionalIds, ...updateData } = data;

    // Atualiza serviço e profissionais associados
    const updated = await prisma.$transaction(async (tx) => {
      // Se professionalIds foi fornecido, atualiza os profissionais associados
      if (professionalIds !== undefined) {
        // Remove associações existentes
        await tx.professionalService.deleteMany({
          where: { serviceId },
        });

        // Cria novas associações
        if (professionalIds.length > 0) {
          await tx.professionalService.createMany({
            data: professionalIds.map((professionalId) => ({
              serviceId,
              professionalId,
            })),
          });
        }
      }

      // Atualiza dados do serviço
      return tx.service.update({
        where: { id: serviceId },
        data: updateData,
        include: {
          professionals: {
            include: {
              professional: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    return updated;
  },

  // Deletar serviço
  async delete(serviceId: string, establishmentId: string) {
    const existing = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!existing) {
      throw new NotFoundError('Serviço');
    }

    if (existing.establishmentId !== establishmentId) {
      throw new ForbiddenError('Serviço não pertence a este estabelecimento');
    }

    await prisma.service.delete({
      where: { id: serviceId },
    });

    return { success: true };
  },
};
