import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { z } from 'zod';

const assignProfessionalsSchema = z.object({
  professionalIds: z.array(z.string().uuid()),
});

// POST /api/services/[id]/professionals - Atribuir profissionais a um servico
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id: serviceId } = await params;
    const body = await request.json();
    const { professionalIds } = assignProfessionalsSchema.parse(body);

    // Verifica se o servico existe e pertence ao estabelecimento
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundError('Servico');
    }

    if (service.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    // Verifica se todos os profissionais pertencem ao estabelecimento
    const professionals = await prisma.professional.findMany({
      where: {
        id: { in: professionalIds },
        establishmentId: authResult.establishmentId,
      },
    });

    if (professionals.length !== professionalIds.length) {
      throw new ForbiddenError('Um ou mais profissionais nao pertencem ao seu estabelecimento');
    }

    // Remove todas as associacoes atuais
    await prisma.professionalService.deleteMany({
      where: { serviceId },
    });

    // Cria as novas associacoes
    if (professionalIds.length > 0) {
      await prisma.professionalService.createMany({
        data: professionalIds.map((professionalId) => ({
          professionalId,
          serviceId,
        })),
      });
    }

    // Retorna o servico atualizado com os profissionais
    const updatedService = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        professionals: {
          include: {
            professional: true,
          },
        },
      },
    });

    return success(updatedService);
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/services/[id]/professionals - Listar profissionais de um servico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const { id: serviceId } = await params;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        professionals: {
          include: {
            professional: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundError('Servico');
    }

    if (service.establishmentId !== authResult.establishmentId) {
      throw new ForbiddenError();
    }

    const professionals = service.professionals.map((ps) => ps.professional);

    return success(professionals);
  } catch (error) {
    return handleError(error);
  }
}
