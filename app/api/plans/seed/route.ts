import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/plans/seed - Cria os planos no banco (rodar apenas uma vez)
export async function POST(request: NextRequest) {
  try {
    // Verifica secret para proteger a rota
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== process.env.SEED_SECRET && secret !== 'zapagenda2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plans = [
      {
        name: 'Essencial',
        description: 'Ideal para profissionais independentes que estao comecando a organizar sua agenda.',
        price: 49.90,
        interval: 'MONTHLY' as const,
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
      {
        name: 'Professional',
        description: 'O favorito de barbearias e saloes que possuem equipe e querem reduzir as faltas.',
        price: 119.90,
        interval: 'MONTHLY' as const,
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
      {
        name: 'Elite',
        description: 'Ideal para estabelecimentos de grande porte ou redes com multiplos profissionais.',
        price: 249.90,
        interval: 'MONTHLY' as const,
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
    ];

    const results = [];

    for (const plan of plans) {
      const existing = await prisma.plan.findFirst({
        where: { name: plan.name },
      });

      if (existing) {
        const updated = await prisma.plan.update({
          where: { id: existing.id },
          data: plan,
        });
        results.push({ action: 'updated', plan: updated.name });
      } else {
        const created = await prisma.plan.create({
          data: plan,
        });
        results.push({ action: 'created', plan: created.name });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Planos criados/atualizados com sucesso',
      results,
    });
  } catch (error) {
    console.error('Erro ao criar planos:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao criar planos' },
      { status: 500 }
    );
  }
}
