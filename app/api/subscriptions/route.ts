import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError, ApiError } from '@/lib/api-utils';
import { createSubscriptionSchema } from '@/lib/validators';

// GET /api/subscriptions - Obter assinatura do usuário
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authResult.id },
      include: {
        plan: true,
      },
    });

    return success(subscription);
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/subscriptions - Criar/atualizar assinatura
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();
    const data = createSubscriptionSchema.parse(body);

    // Verifica se plano existe
    const plan = await prisma.plan.findUnique({
      where: { id: data.planId },
    });

    if (!plan || !plan.active) {
      throw new NotFoundError('Plano');
    }

    // Cria ou atualiza assinatura
    const subscription = await prisma.subscription.upsert({
      where: { userId: authResult.id },
      update: {
        planId: data.planId,
        status: 'ACTIVE',
        startDate: new Date(),
      },
      create: {
        userId: authResult.id,
        planId: data.planId,
        status: 'ACTIVE',
        startDate: new Date(),
      },
      include: {
        plan: true,
      },
    });

    return success(subscription, 201);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/subscriptions - Cancelar assinatura
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authResult.id },
    });

    if (!subscription) {
      throw new NotFoundError('Assinatura');
    }

    await prisma.subscription.update({
      where: { userId: authResult.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return success({ message: 'Assinatura cancelada com sucesso' });
  } catch (error) {
    return handleError(error);
  }
}
