import prisma from '../models/prisma';
import { CreateProfessionalInput, UpdateProfessionalInput } from '../utils/validators';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { PaginationParams } from '../types';

export const professionalsService = {
  // Criar novo profissional
  async create(establishmentId: string, data: CreateProfessionalInput) {
    const { serviceIds, ...professionalData } = data;

    const professional = await prisma.professional.create({
      data: {
        ...professionalData,
        establishmentId,
        // Associa aos serviços se fornecidos
        services: serviceIds?.length
          ? {
              create: serviceIds.map((serviceId) => ({
                serviceId,
              })),
            }
          : undefined,
      },
      include: {
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    return professional;
  },

  // Listar profissionais do estabelecimento
  async list(establishmentId: string, pagination?: PaginationParams) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const [professionals, total] = await Promise.all([
      prisma.professional.findMany({
        where: { establishmentId },
        include: {
          services: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  duration: true,
                  price: true,
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
      prisma.professional.count({ where: { establishmentId } }),
    ]);

    return {
      data: professionals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // Obter profissional por ID
  async getById(professionalId: string, establishmentId: string) {
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        _count: {
          select: {
            appointments: true,
          },
        },
      },
    });

    if (!professional) {
      throw new NotFoundError('Profissional');
    }

    if (professional.establishmentId !== establishmentId) {
      throw new ForbiddenError('Profissional não pertence a este estabelecimento');
    }

    return professional;
  },

  // Atualizar profissional
  async update(professionalId: string, establishmentId: string, data: UpdateProfessionalInput) {
    const existing = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!existing) {
      throw new NotFoundError('Profissional');
    }

    if (existing.establishmentId !== establishmentId) {
      throw new ForbiddenError('Profissional não pertence a este estabelecimento');
    }

    const { serviceIds, ...updateData } = data;

    // Atualiza profissional e serviços associados
    const updated = await prisma.$transaction(async (tx) => {
      // Se serviceIds foi fornecido, atualiza os serviços associados
      if (serviceIds !== undefined) {
        // Remove associações existentes
        await tx.professionalService.deleteMany({
          where: { professionalId },
        });

        // Cria novas associações
        if (serviceIds.length > 0) {
          await tx.professionalService.createMany({
            data: serviceIds.map((serviceId) => ({
              professionalId,
              serviceId,
            })),
          });
        }
      }

      // Atualiza dados do profissional
      return tx.professional.update({
        where: { id: professionalId },
        data: updateData,
        include: {
          services: {
            include: {
              service: true,
            },
          },
        },
      });
    });

    return updated;
  },

  // Deletar profissional
  async delete(professionalId: string, establishmentId: string) {
    const existing = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!existing) {
      throw new NotFoundError('Profissional');
    }

    if (existing.establishmentId !== establishmentId) {
      throw new ForbiddenError('Profissional não pertence a este estabelecimento');
    }

    await prisma.professional.delete({
      where: { id: professionalId },
    });

    return { success: true };
  },
};
