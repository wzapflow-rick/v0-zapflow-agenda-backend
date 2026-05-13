import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError } from '@/lib/api-utils';

// Limites do plano Free
const FREE_PLAN_LIMITS = {
  maxProfessionals: 1,
  maxServices: 3,
  maxAppointments: 50,
  features: {
    whatsappMessages: false,
    customBranding: false,
    reports: false,
    multipleLocations: false,
    prioritySupport: false,
  },
};

// GET /api/subscriptions/permissions - Obter permissoes do plano atual
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (isAuthError(authResult)) return authResult;

    // Busca assinatura ativa
    const subscription = await prisma.subscription.findUnique({
      where: { userId: authResult.id },
      include: { plan: true },
    });

    // Verifica se tem assinatura ativa
    const isSubscriptionActive = subscription && 
      subscription.status === 'ACTIVE' &&
      (!subscription.endDate || new Date(subscription.endDate) > new Date());

    if (!isSubscriptionActive || !subscription?.plan) {
      // Retorna limites do plano Free
      return success({
        planName: 'Free',
        isActive: false,
        limits: {
          maxProfessionals: FREE_PLAN_LIMITS.maxProfessionals,
          maxServices: FREE_PLAN_LIMITS.maxServices,
          maxAppointments: FREE_PLAN_LIMITS.maxAppointments,
        },
        features: FREE_PLAN_LIMITS.features,
        subscription: null,
      });
    }

    // Extrai features do plano (JSON)
    const planFeatures = subscription.plan.features as Record<string, boolean> || {};

    return success({
      planName: subscription.plan.name,
      isActive: true,
      limits: {
        maxProfessionals: subscription.plan.maxProfessionals,
        maxServices: subscription.plan.maxServices,
        maxAppointments: subscription.plan.maxAppointments,
      },
      features: {
        whatsappMessages: planFeatures.whatsappMessages ?? true,
        customBranding: planFeatures.customBranding ?? false,
        reports: planFeatures.reports ?? false,
        multipleLocations: planFeatures.multipleLocations ?? false,
        prioritySupport: planFeatures.prioritySupport ?? false,
        ...planFeatures,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
