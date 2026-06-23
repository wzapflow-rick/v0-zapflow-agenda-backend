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

// Funcao para gerar slug a partir do nome
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '-') // Substitui espacos por hifens
    .replace(/-+/g, '-') // Remove hifens duplicados
    .replace(/^-|-$/g, ''); // Remove hifens no inicio e fim
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

    // Se o nome mudou e slug não foi fornecido, gera novo slug automaticamente
    let newSlug = data.slug;
    if (data.name && data.name !== establishment.name && !data.slug) {
      newSlug = generateSlug(data.name);
    }

    // Se está atualizando o slug (fornecido ou gerado), verifica se já existe
    if (newSlug && newSlug !== establishment.slug) {
      const existingSlug = await prisma.establishment.findUnique({
        where: { slug: newSlug },
      });
      if (existingSlug) {
        // Se slug gerado ja existe, adiciona numero aleatorio
        newSlug = `${newSlug}-${Math.floor(Math.random() * 1000)}`;
      }
    }

    // Normaliza businessHours - aceita tanto workingHours quanto businessHours
    const rawHours = data.businessHours || data.workingHours;
    const normalizedHours = normalizeWorkingHours(rawHours);

    // Atualiza estabelecimento
    const updated = await prisma.establishment.update({
      where: { id: establishment.id },
      data: {
        name: data.name,
        slug: newSlug,
        description: data.description,
        phone: data.phone,
        email: data.email,
        address: data.address,
        logo: data.logoUrl,
        timezone: data.timezone,
        slotDuration: data.slotDuration,
        businessHours: normalizedHours,
        businessType: data.businessType,
        // metadata: undefined preserva o valor atual; null limpa explicitamente
        ...(data.metadata !== undefined ? { metadata: data.metadata ?? undefined } : {}),
      },
    });

    return success(updated);
  } catch (error) {
    return handleError(error);
  }
}
