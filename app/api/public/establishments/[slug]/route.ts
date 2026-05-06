import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError, NotFoundError } from '@/lib/api-utils';

// GET /api/public/[slug] - Obter dados públicos do estabelecimento
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const establishment = await prisma.establishment.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        phone: true,
        address: true,
        logo: true,
        businessHours: true,
        timezone: true,
        slotDuration: true,
        professionals: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            avatar: true,
            bio: true,
            services: {
              select: {
                service: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    duration: true,
                    price: true,
                  },
                },
              },
            },
          },
        },
        services: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            description: true,
            duration: true,
            price: true,
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
