import prisma from '../models/prisma';
import { UpdateEstablishmentInput } from '../utils/validators';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export const establishmentsService = {
  // Obter detalhes do estabelecimento
  async getById(establishmentId: string, userId: string) {
    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            professionals: true,
            services: true,
            clients: true,
            appointments: true,
          },
        },
      },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    // Verifica se o usuário é dono do estabelecimento
    if (establishment.userId !== userId) {
      throw new ForbiddenError('Você não tem permissão para acessar este estabelecimento');
    }

    return establishment;
  },

  // Atualizar estabelecimento
  async update(establishmentId: string, userId: string, data: UpdateEstablishmentInput) {
    // Verifica se o estabelecimento existe e pertence ao usuário
    const existing = await prisma.establishment.findUnique({
      where: { id: establishmentId },
    });

    if (!existing) {
      throw new NotFoundError('Estabelecimento');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError('Você não tem permissão para editar este estabelecimento');
    }

    // Atualiza o estabelecimento
    const updated = await prisma.establishment.update({
      where: { id: establishmentId },
      data: {
        name: data.name,
        description: data.description,
        address: data.address,
        phone: data.phone,
        email: data.email,
        logo: data.logo,
        businessHours: data.businessHours,
        timezone: data.timezone,
        slotDuration: data.slotDuration,
      },
      include: {
        _count: {
          select: {
            professionals: true,
            services: true,
            clients: true,
            appointments: true,
          },
        },
      },
    });

    return updated;
  },

  // Obter estabelecimento pelo slug (público)
  async getBySlug(slug: string) {
    const establishment = await prisma.establishment.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        address: true,
        phone: true,
        email: true,
        logo: true,
        businessHours: true,
        timezone: true,
        slotDuration: true,
      },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    return establishment;
  },
};
