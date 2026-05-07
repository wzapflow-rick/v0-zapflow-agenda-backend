import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { updateEstablishmentSchema, normalizeWorkingHours } from '@/lib/validators';

// GET /api/establishments - Obter estabelecimento do usuário logado
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const establishment = await prisma.establishment.findUnique({
      where: { userId: authResult.id },
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

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    return success(establishment);
  } catch (error) {
    return handleError(error);
  }
}

// PUT /api/establishments - Atualizar estabelecimento do usuário logado
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();
    const data = updateEstablishmentSchema.parse(body);

    // Busca estabelecimento do usuário
    const establishment = await prisma.establishment.findUnique({
      where: { userId: authResult.id },
    });

    if (!establishment) {
      throw new NotFoundError('Estabelecimento');
    }

    // Se está atualizando o slug, verifica se já existe
    if (data.slug && data.slug !== establishment.slug) {
      const existingSlug = await prisma.establishment.findUnique({
        where: { slug: data.slug },
      });
      if (existingSlug) {
        return success({ error: 'Slug já está em uso' }, 409);
      }
    }

    // Normaliza os horários de funcionamento (aceita businessHours ou workingHours)
    const rawBusinessHours = data.businessHours ?? data.workingHours;
    const normalizedBusinessHours = normalizeWorkingHours(rawBusinessHours);

    // Atualiza estabelecimento
    const updated = await prisma.establishment.update({
      where: { id: establishment.id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        phone: data.phone,
        email: data.email,
        address: data.address,
        logo: data.logoUrl,
        timezone: data.timezone,
        slotDuration: data.slotDuration,
        businessHours: normalizedBusinessHours,
      },
    });

    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}
