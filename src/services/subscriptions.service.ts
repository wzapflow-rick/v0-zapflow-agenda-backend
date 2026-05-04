import prisma from '../models/prisma';
import { NotFoundError, SubscriptionError } from '../utils/errors';

// NOTA: Esta é uma implementação placeholder para integração com gateways de pagamento.
// Em produção, você deve implementar a integração real com Stripe, Mercado Pago, etc.

export const subscriptionsService = {
  // Listar planos disponíveis
  async listPlans() {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });

    return plans;
  },

  // Obter assinatura atual do usuário
  async getCurrent(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return null;
    }

    return subscription;
  },

  // Iniciar checkout para um plano
  // PLACEHOLDER: Em produção, integrar com gateway de pagamento
  async checkout(userId: string, planId: string) {
    // Verifica se o plano existe
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.active) {
      throw new NotFoundError('Plano');
    }

    // Verifica se o usuário já tem uma assinatura ativa
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      throw new SubscriptionError('Você já possui uma assinatura ativa. Cancele a atual antes de assinar outro plano.');
    }

    // PLACEHOLDER: Aqui você integraria com o gateway de pagamento
    // Exemplo com Stripe:
    // const session = await stripe.checkout.sessions.create({
    //   mode: 'subscription',
    //   customer_email: user.email,
    //   line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    //   success_url: `${process.env.FRONTEND_URL}/subscription/success`,
    //   cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
    //   metadata: { userId, planId },
    // });

    // Retorna URL de checkout (placeholder)
    return {
      checkoutUrl: `https://checkout.example.com/session/${Date.now()}`,
      sessionId: `session_${Date.now()}`,
      message: 'PLACEHOLDER: Em produção, retornaria URL do gateway de pagamento',
    };
  },

  // Processar webhook do gateway de pagamento
  // PLACEHOLDER: Em produção, validar assinatura do webhook e processar eventos
  async handleWebhook(payload: any, signature?: string) {
    // PLACEHOLDER: Validar assinatura do webhook
    // Exemplo com Stripe:
    // const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    const event = payload; // Em produção, usar evento validado

    switch (event.type) {
      case 'checkout.session.completed': {
        // Assinatura criada com sucesso
        const { userId, planId } = event.metadata || {};
        
        if (userId && planId) {
          await prisma.subscription.upsert({
            where: { userId },
            update: {
              planId,
              status: 'ACTIVE',
              startDate: new Date(),
              endDate: null,
              gatewaySubscriptionId: event.subscription,
              gatewayCustomerId: event.customer,
            },
            create: {
              userId,
              planId,
              status: 'ACTIVE',
              startDate: new Date(),
              gatewaySubscriptionId: event.subscription,
              gatewayCustomerId: event.customer,
            },
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Pagamento de renovação bem-sucedido
        const subscriptionId = event.subscription;
        
        await prisma.subscription.updateMany({
          where: { gatewaySubscriptionId: subscriptionId },
          data: { status: 'ACTIVE' },
        });
        break;
      }

      case 'invoice.payment_failed': {
        // Pagamento falhou
        const subscriptionId = event.subscription;
        
        await prisma.subscription.updateMany({
          where: { gatewaySubscriptionId: subscriptionId },
          data: { status: 'PAST_DUE' },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        // Assinatura cancelada
        const subscriptionId = event.id;
        
        await prisma.subscription.updateMany({
          where: { gatewaySubscriptionId: subscriptionId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            endDate: new Date(),
          },
        });
        break;
      }

      default:
        console.log(`Evento de webhook não tratado: ${event.type}`);
    }

    return { received: true };
  },

  // Cancelar assinatura
  async cancel(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundError('Assinatura');
    }

    if (subscription.status === 'CANCELLED') {
      throw new SubscriptionError('Assinatura já está cancelada');
    }

    // PLACEHOLDER: Em produção, cancelar no gateway de pagamento
    // Exemplo com Stripe:
    // await stripe.subscriptions.cancel(subscription.gatewaySubscriptionId);

    // Atualiza status da assinatura
    const updated = await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        // Define data de término para o final do período atual
        endDate: subscription.startDate
          ? new Date(subscription.startDate.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 dias
          : new Date(),
      },
      include: {
        plan: true,
      },
    });

    return updated;
  },

  // Verificar se usuário tem assinatura ativa
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    return subscription?.status === 'ACTIVE';
  },

  // Verificar limites do plano
  async checkPlanLimits(userId: string): Promise<{
    canAddProfessional: boolean;
    canAddService: boolean;
    canCreateAppointment: boolean;
    limits: {
      maxProfessionals: number;
      maxServices: number;
      maxAppointments: number;
    };
    current: {
      professionals: number;
      services: number;
      appointmentsThisMonth: number;
    };
  }> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true, user: { include: { establishment: true } } },
    });

    // Limites padrão (plano gratuito)
    const defaultLimits = {
      maxProfessionals: 1,
      maxServices: 5,
      maxAppointments: 50,
    };

    const limits = subscription?.plan
      ? {
          maxProfessionals: subscription.plan.maxProfessionals,
          maxServices: subscription.plan.maxServices,
          maxAppointments: subscription.plan.maxAppointments,
        }
      : defaultLimits;

    // Conta recursos atuais
    const establishmentId = subscription?.user?.establishment?.id;

    if (!establishmentId) {
      return {
        canAddProfessional: true,
        canAddService: true,
        canCreateAppointment: true,
        limits,
        current: {
          professionals: 0,
          services: 0,
          appointmentsThisMonth: 0,
        },
      };
    }

    const [professionalsCount, servicesCount, appointmentsCount] = await Promise.all([
      prisma.professional.count({ where: { establishmentId } }),
      prisma.service.count({ where: { establishmentId } }),
      prisma.appointment.count({
        where: {
          establishmentId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return {
      canAddProfessional: professionalsCount < limits.maxProfessionals,
      canAddService: servicesCount < limits.maxServices,
      canCreateAppointment: appointmentsCount < limits.maxAppointments,
      limits,
      current: {
        professionals: professionalsCount,
        services: servicesCount,
        appointmentsThisMonth: appointmentsCount,
      },
    };
  },
};
