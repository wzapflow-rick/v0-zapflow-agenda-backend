import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError, NotFoundError } from '@/lib/api-utils';
import { createSubscriptionPreference } from '@/lib/mercadopago';
import { z } from 'zod';

const createSubscriptionSchema = z.object({
  planId: z.string().uuid(),
});

// GET /api/subscriptions - Obter assinatura do usuario
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

    // Se nao tem assinatura, retorna plano free por padrao
    if (!subscription) {
      return success({
        subscription: null,
        plan: {
          name: 'Free',
          maxProfessionals: 1,
          maxServices: 3,
          maxAppointments: 50,
          features: ['1 profissional', '3 servicos', '50 agendamentos/mes'],
        },
        isActive: false,
      });
    }

    // Verifica se assinatura esta ativa e nao expirou
    const isActive = subscription.status === 'ACTIVE' && 
      (!subscription.endDate || new Date(subscription.endDate) > new Date());

    return success({
      subscription,
      plan: subscription.plan,
      isActive,
    });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/subscriptions - Criar preferencia de pagamento para assinar plano
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();
    console.log("[v0] POST /api/subscriptions - Body recebido:", JSON.stringify(body));
    
    const parseResult = createSubscriptionSchema.safeParse(body);
    if (!parseResult.success) {
      console.log("[v0] Erro de validação Zod:", JSON.stringify(parseResult.error.errors));
      throw parseResult.error;
    }
    const data = parseResult.data;

    // Busca plano
    const plan = await prisma.plan.findUnique({
      where: { id: data.planId },
    });

    if (!plan || !plan.active) {
      throw new NotFoundError('Plano');
    }

    // Busca usuario completo
    const user = await prisma.user.findUnique({
      where: { id: authResult.id },
    });

    if (!user) {
      throw new NotFoundError('Usuario');
    }

    // Cria preferencia de pagamento no Mercado Pago
    const preference = await createSubscriptionPreference({
      planId: plan.id,
      planName: plan.name,
      planPrice: Number(plan.price),
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
    });

    return success({
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    }, 201);
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

const changeSubscriptionSchema = z.object({
  planId: z.string().uuid(),
});

// PATCH /api/subscriptions - Alterar plano da assinatura
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();
    const data = changeSubscriptionSchema.parse(body);

    // Busca assinatura atual
    const subscription = await prisma.subscription.findUnique({
      where: { userId: authResult.id },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundError('Assinatura');
    }

    // Busca novo plano
    const newPlan = await prisma.plan.findUnique({
      where: { id: data.planId },
    });

    if (!newPlan || !newPlan.active) {
      throw new NotFoundError('Plano');
    }

    // Se o plano é o mesmo, não faz nada
    if (subscription.planId === data.planId) {
      return success({
        message: 'Você já está neste plano',
        subscription,
        plan: newPlan,
      });
    }

    // Se está em trial, permite trocar de plano livremente
    if (subscription.status === 'TRIALING') {
      // Calcula novo trialEndsAt mantendo os dias restantes
      const now = new Date();
      const trialEndsAt = subscription.trialEndsAt;
      
      const updatedSubscription = await prisma.subscription.update({
        where: { userId: authResult.id },
        data: {
          planId: data.planId,
        },
        include: { plan: true },
      });

      return success({
        message: `Plano alterado para ${newPlan.name} com sucesso!`,
        subscription: updatedSubscription,
        plan: updatedSubscription.plan,
      });
    }

    // Se está ativo (pagando), precisa criar nova preferência de pagamento
    // para o upgrade/downgrade
    if (subscription.status === 'ACTIVE') {
      const user = await prisma.user.findUnique({
        where: { id: authResult.id },
      });

      if (!user) {
        throw new NotFoundError('Usuario');
      }

      // Cria preferência de pagamento para o novo plano
      const preference = await createSubscriptionPreference({
        planId: newPlan.id,
        planName: newPlan.name,
        planPrice: Number(newPlan.price),
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
      });

      return success({
        message: 'Redirecionando para pagamento do novo plano',
        requiresPayment: true,
        preferenceId: preference.id,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
        newPlan: {
          id: newPlan.id,
          name: newPlan.name,
          price: newPlan.price,
        },
      });
    }

    // Para outros status (CANCELLED, INACTIVE, etc.), 
    // atualiza diretamente mas mantém o status
    const updatedSubscription = await prisma.subscription.update({
      where: { userId: authResult.id },
      data: {
        planId: data.planId,
      },
      include: { plan: true },
    });

    return success({
      message: `Plano alterado para ${newPlan.name}`,
      subscription: updatedSubscription,
      plan: updatedSubscription.plan,
    });
  } catch (error) {
    return handleError(error);
  }
}
