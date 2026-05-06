import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError } from '@/lib/api-utils';

// GET /api/plans - Listar planos disponíveis
export async function GET(request: NextRequest) {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });

    return success(plans);
  } catch (error) {
    return handleError(error);
  }
}
