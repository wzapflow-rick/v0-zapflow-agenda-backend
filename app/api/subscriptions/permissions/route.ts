import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, isAuthError } from '@/lib/auth';
import { success, handleError } from '@/lib/api-utils';

// Features padrao para cada plano
const PLAN_FEATURES = {
  Essencial: {
    whatsappAutomations: 3,
    bookingPage: true,
    instagramBioLink: true,
    onlinePayment: false,
    financialDashboard: false,
    prioritySupport: false,
    recurringAppointments: false,
    paymentSplit: false,
    waitlist: false,
    advancedBI: false,
    retentionReports: false,
  },
  Professional: {
    whatsappAutomations: 999,
    bookingPage: true,
    instagramBioLink: true,
    onlinePayment: true,
    financialDashboard: true,
    prioritySupport: true,
    recurringAppointments: false,
    paymentSplit: false,
    waitlist: false,
    advancedBI: false,
    retentionReports: false,
  },
  Elite: {
    whatsappAutomations: 999,
    bookingPage: true,
    instagramBioLink: true,
    onlinePayment: true,
    financialDashboard: true,
    prioritySupport: true,
    recurringAppointments: true,
    paymentSplit: true,
    waitlist: true,
    advancedBI: true,
    retentionReports: true,
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

    // Verifica se tem assinatura ativa ou em trial
    const isTrialing = subscription?.status === 'TRIALING' && 
      subscription.trialEndsAt && new Date(subscription.trialEndsAt) > new Date();
    
    const isActive = subscription?.status === 'ACTIVE' &&
      (!subscription.endDate || new Date(subscription.endDate) > new Date());
    
    const isSubscriptionActive = subscription && (isTrialing || isActive);

    if (!isSubscriptionActive || !subscription?.plan) {
      // Usuario sem assinatura - nao pode usar o sistema
      return success({
        planName: null,
        isActive: false,
        hasSubscription: false,
        limits: {
          maxProfessionals: 0,
          maxServices: 0,
          maxAppointments: 0,
        },
        features: {
          whatsappAutomations: 0,
          bookingPage: false,
          instagramBioLink: false,
          onlinePayment: false,
          financialDashboard: false,
          prioritySupport: false,
          recurringAppointments: false,
          paymentSplit: false,
          waitlist: false,
          advancedBI: false,
          retentionReports: false,
        },
        subscription: null,
        message: 'Voce precisa assinar um plano para usar o sistema.',
      });
    }

    // Extrai features do plano (JSON) ou usa padrao
    const planFeatures = (subscription.plan.features as Record<string, unknown>) || 
      PLAN_FEATURES[subscription.plan.name as keyof typeof PLAN_FEATURES] || 
      PLAN_FEATURES.Essencial;

    // Calcula dias restantes do trial se aplicavel
    let trialDaysRemaining = 0;
    if (subscription.status === 'TRIALING' && subscription.trialEndsAt) {
      const now = new Date();
      const end = new Date(subscription.trialEndsAt);
      trialDaysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return success({
      planName: subscription.plan.name,
      planDescription: subscription.plan.description,
      price: subscription.plan.price,
      isActive: true,
      hasSubscription: true,
      isTrial: subscription.status === 'TRIALING',
      trialEndsAt: subscription.trialEndsAt,
      trialDaysRemaining,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        description: subscription.plan.description,
        price: subscription.plan.price,
        maxProfessionals: subscription.plan.maxProfessionals,
        maxServices: subscription.plan.maxServices,
        maxAppointments: subscription.plan.maxAppointments,
      },
      limits: {
        maxProfessionals: subscription.plan.maxProfessionals,
        maxServices: subscription.plan.maxServices,
        maxAppointments: subscription.plan.maxAppointments,
      },
      features: planFeatures,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndsAt: subscription.trialEndsAt,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
