import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError } from '@/lib/api-utils';

// Limites do plano Free
const FREE_PLAN_LIMITS = {
  maxProfessionals: 1,
  maxServices: 3,
  maxAppointments: 50,
};

// GET /api/subscriptions/usage - Obter uso atual vs limites do plano
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    // Busca assinatura ativa
    const subscription = await prisma.subscription.findUnique({
      where: { userId: authResult.id },
      include: { plan: true },
    });

    // Define limites baseado no plano
    const isTrialing = subscription?.status === 'TRIALING' &&
      subscription.trialEndsAt && new Date(subscription.trialEndsAt) > new Date();
    
    const isActive = subscription?.status === 'ACTIVE' &&
      (!subscription.endDate || new Date(subscription.endDate) > new Date());
    
    const isSubscriptionActive = subscription && (isTrialing || isActive);

    const limits = isSubscriptionActive && subscription?.plan
      ? {
          maxProfessionals: subscription.plan.maxProfessionals,
          maxServices: subscription.plan.maxServices,
          maxAppointments: subscription.plan.maxAppointments,
        }
      : FREE_PLAN_LIMITS;

    // Busca uso atual
    const [professionalsCount, servicesCount, appointmentsThisMonth] = await Promise.all([
      prisma.professional.count({
        where: { establishmentId: authResult.establishmentId, active: true },
      }),
      prisma.service.count({
        where: { establishmentId: authResult.establishmentId, active: true },
      }),
      prisma.appointment.count({
        where: {
          establishmentId: authResult.establishmentId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return success({
      usage: {
        professionals: professionalsCount,
        services: servicesCount,
        appointmentsThisMonth,
      },
      limits: {
        professionals: limits.maxProfessionals,
        services: limits.maxServices,
        appointments: limits.maxAppointments,
      },
      canAdd: {
        professional: professionalsCount < limits.maxProfessionals,
        service: servicesCount < limits.maxServices,
        appointment: appointmentsThisMonth < limits.maxAppointments,
      },
      percentUsed: {
        professionals: Math.round((professionalsCount / limits.maxProfessionals) * 100),
        services: Math.round((servicesCount / limits.maxServices) * 100),
        appointments: Math.round((appointmentsThisMonth / limits.maxAppointments) * 100),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
