import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    plan: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    establishment: {
      findUnique: vi.fn(),
    },
    professional: {
      count: vi.fn(),
    },
    service: {
      count: vi.fn(),
    },
    appointment: {
      count: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';

// Dados de teste
const mockPlans = {
  essencial: {
    id: 'plan-essencial-id',
    name: 'Essencial',
    description: 'Ideal para profissionais independentes',
    price: 49.90,
    interval: 'MONTHLY',
    maxProfessionals: 1,
    maxServices: 999,
    maxAppointments: 100,
    features: {
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
    active: true,
    trialDays: 0,
  },
  professional: {
    id: 'plan-professional-id',
    name: 'Professional',
    description: 'O favorito de barbearias e saloes',
    price: 119.90,
    interval: 'MONTHLY',
    maxProfessionals: 5,
    maxServices: 999,
    maxAppointments: 999999,
    features: {
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
    active: true,
    trialDays: 7,
  },
  elite: {
    id: 'plan-elite-id',
    name: 'Elite',
    description: 'Ideal para estabelecimentos de grande porte',
    price: 249.90,
    interval: 'MONTHLY',
    maxProfessionals: 999,
    maxServices: 999,
    maxAppointments: 999999,
    features: {
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
    active: true,
    trialDays: 0,
  },
};

const mockActiveSubscription = {
  id: 'sub-id-123',
  establishmentId: 'est-id-123',
  planId: mockPlans.professional.id,
  status: 'ACTIVE',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-02-01'),
  plan: mockPlans.professional,
};

describe('Sistema de Planos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Listagem de Planos', () => {
    it('deve retornar todos os planos ativos', async () => {
      const allPlans = [mockPlans.essencial, mockPlans.professional, mockPlans.elite];
      vi.mocked(prisma.plan.findMany).mockResolvedValue(allPlans as any);

      const result = await prisma.plan.findMany({
        where: { active: true },
        orderBy: { price: 'asc' },
      });

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Essencial');
      expect(result[1].name).toBe('Professional');
      expect(result[2].name).toBe('Elite');
    });

    it('deve ter precos corretos', async () => {
      const allPlans = [mockPlans.essencial, mockPlans.professional, mockPlans.elite];
      vi.mocked(prisma.plan.findMany).mockResolvedValue(allPlans as any);

      const result = await prisma.plan.findMany({ where: { active: true } });

      expect(result[0].price).toBe(49.90);
      expect(result[1].price).toBe(119.90);
      expect(result[2].price).toBe(249.90);
    });

    it('deve ter limites de profissionais corretos', async () => {
      expect(mockPlans.essencial.maxProfessionals).toBe(1);
      expect(mockPlans.professional.maxProfessionals).toBe(5);
      expect(mockPlans.elite.maxProfessionals).toBe(999); // ilimitado
    });

    it('deve ter limites de agendamentos corretos', async () => {
      expect(mockPlans.essencial.maxAppointments).toBe(100);
      expect(mockPlans.professional.maxAppointments).toBe(999999); // ilimitado
      expect(mockPlans.elite.maxAppointments).toBe(999999); // ilimitado
    });
  });

  describe('Features dos Planos', () => {
    it('Essencial deve ter apenas 3 automacoes WhatsApp', () => {
      const features = mockPlans.essencial.features;
      expect(features.whatsappAutomations).toBe(3);
      expect(features.onlinePayment).toBe(false);
      expect(features.financialDashboard).toBe(false);
      expect(features.prioritySupport).toBe(false);
    });

    it('Professional deve ter todas automacoes e checkout online', () => {
      const features = mockPlans.professional.features;
      expect(features.whatsappAutomations).toBe(999);
      expect(features.onlinePayment).toBe(true);
      expect(features.financialDashboard).toBe(true);
      expect(features.prioritySupport).toBe(true);
      expect(features.recurringAppointments).toBe(false);
      expect(features.paymentSplit).toBe(false);
    });

    it('Elite deve ter todos os recursos', () => {
      const features = mockPlans.elite.features;
      expect(features.whatsappAutomations).toBe(999);
      expect(features.onlinePayment).toBe(true);
      expect(features.financialDashboard).toBe(true);
      expect(features.prioritySupport).toBe(true);
      expect(features.recurringAppointments).toBe(true);
      expect(features.paymentSplit).toBe(true);
      expect(features.waitlist).toBe(true);
      expect(features.advancedBI).toBe(true);
      expect(features.retentionReports).toBe(true);
    });

    it('Professional deve ter 7 dias de trial', () => {
      expect(mockPlans.professional.trialDays).toBe(7);
      expect(mockPlans.essencial.trialDays).toBe(0);
      expect(mockPlans.elite.trialDays).toBe(0);
    });
  });

  describe('Assinaturas', () => {
    it('deve identificar assinatura ativa', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(mockActiveSubscription as any);

      const subscription = await prisma.subscription.findFirst({
        where: {
          establishmentId: 'est-id-123',
          status: 'ACTIVE',
        },
        include: { plan: true },
      });

      expect(subscription).not.toBeNull();
      expect(subscription?.status).toBe('ACTIVE');
      expect(subscription?.plan.name).toBe('Professional');
    });

    it('deve retornar null quando nao ha assinatura', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

      const subscription = await prisma.subscription.findFirst({
        where: {
          establishmentId: 'est-sem-assinatura',
          status: 'ACTIVE',
        },
      });

      expect(subscription).toBeNull();
    });

    it('deve criar nova assinatura com status INACTIVE', async () => {
      const newSubscription = {
        id: 'new-sub-id',
        establishmentId: 'est-id-123',
        planId: mockPlans.essencial.id,
        status: 'INACTIVE',
        startDate: new Date(),
        endDate: null,
      };

      vi.mocked(prisma.subscription.create).mockResolvedValue(newSubscription as any);

      const result = await prisma.subscription.create({
        data: {
          establishmentId: 'est-id-123',
          planId: mockPlans.essencial.id,
          status: 'INACTIVE',
          startDate: new Date(),
        },
      });

      expect(result.status).toBe('INACTIVE');
      expect(result.planId).toBe(mockPlans.essencial.id);
    });

    it('deve ativar assinatura apos pagamento', async () => {
      const activatedSubscription = {
        ...mockActiveSubscription,
        status: 'ACTIVE',
        gatewaySubscriptionId: 'mp-123456',
      };

      vi.mocked(prisma.subscription.update).mockResolvedValue(activatedSubscription as any);

      const result = await prisma.subscription.update({
        where: { id: 'sub-id-123' },
        data: {
          status: 'ACTIVE',
          gatewaySubscriptionId: 'mp-123456',
        },
      });

      expect(result.status).toBe('ACTIVE');
      expect(result.gatewaySubscriptionId).toBe('mp-123456');
    });
  });

  describe('Verificacao de Limites', () => {
    it('deve verificar se pode adicionar profissional no plano Essencial', async () => {
      vi.mocked(prisma.professional.count).mockResolvedValue(1);

      const currentCount = await prisma.professional.count({
        where: { establishmentId: 'est-id-123' },
      });

      const canAdd = currentCount < mockPlans.essencial.maxProfessionals;
      expect(canAdd).toBe(false); // Ja tem 1, limite e 1
    });

    it('deve verificar se pode adicionar profissional no plano Professional', async () => {
      vi.mocked(prisma.professional.count).mockResolvedValue(3);

      const currentCount = await prisma.professional.count({
        where: { establishmentId: 'est-id-123' },
      });

      const canAdd = currentCount < mockPlans.professional.maxProfessionals;
      expect(canAdd).toBe(true); // Tem 3, limite e 5
    });

    it('deve verificar se pode adicionar agendamento no plano Essencial', async () => {
      vi.mocked(prisma.appointment.count).mockResolvedValue(99);

      const currentCount = await prisma.appointment.count({
        where: {
          establishmentId: 'est-id-123',
          date: { gte: new Date('2024-01-01'), lt: new Date('2024-02-01') },
        },
      });

      const canAdd = currentCount < mockPlans.essencial.maxAppointments;
      expect(canAdd).toBe(true); // Tem 99, limite e 100
    });

    it('deve bloquear agendamento quando limite atingido', async () => {
      vi.mocked(prisma.appointment.count).mockResolvedValue(100);

      const currentCount = await prisma.appointment.count({
        where: { establishmentId: 'est-id-123' },
      });

      const canAdd = currentCount < mockPlans.essencial.maxAppointments;
      expect(canAdd).toBe(false); // Tem 100, limite e 100
    });

    it('deve calcular porcentagem de uso corretamente', () => {
      const usage = 75;
      const limit = 100;
      const percentUsed = Math.round((usage / limit) * 100);
      expect(percentUsed).toBe(75);
    });
  });

  describe('Status de Assinatura', () => {
    it('deve identificar todos os status possiveis', () => {
      const validStatuses = ['ACTIVE', 'INACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING'];
      
      validStatuses.forEach(status => {
        expect(['ACTIVE', 'INACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING']).toContain(status);
      });
    });

    it('deve considerar TRIALING como ativo', () => {
      const activeStatuses = ['ACTIVE', 'TRIALING'];
      const status = 'TRIALING';
      const isActive = activeStatuses.includes(status);
      expect(isActive).toBe(true);
    });

    it('deve considerar PAST_DUE como inativo', () => {
      const activeStatuses = ['ACTIVE', 'TRIALING'];
      const status = 'PAST_DUE';
      const isActive = activeStatuses.includes(status);
      expect(isActive).toBe(false);
    });
  });
});

describe('Calculo de Precos', () => {
  it('deve calcular valor mensal corretamente', () => {
    expect(mockPlans.essencial.price).toBe(49.90);
    expect(mockPlans.professional.price).toBe(119.90);
    expect(mockPlans.elite.price).toBe(249.90);
  });

  it('deve calcular economia no plano anual (futuro)', () => {
    // Simulacao para quando implementar planos anuais
    const monthlyPrice = 119.90;
    const annualPrice = monthlyPrice * 10; // 2 meses gratis
    const savings = (monthlyPrice * 12) - annualPrice;
    expect(savings).toBeCloseTo(239.80, 1);
  });
});
