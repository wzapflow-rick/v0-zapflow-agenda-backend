import prisma from '../lib/prisma';

// Script para criar os planos no banco de dados
// Rodar com: npx tsx scripts/seed-plans.ts

async function seedPlans() {
  console.log('Criando planos...');

  const plans = [
    {
      name: 'Essencial',
      description: 'Ideal para profissionais independentes que estao comecando a organizar sua agenda.',
      price: 49.90,
      interval: 'MONTHLY' as const,
      maxProfessionals: 1,
      maxServices: 999, // ilimitado
      maxAppointments: 100,
      features: {
        whatsappAutomations: 3, // 3 automacoes de WhatsApp
        bookingPage: true,
        instagramBioLink: true,
        onlinePayment: false, // pagamentos apenas no local
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
      maxServices: 999, // ilimitado
      maxAppointments: 999999, // ilimitado
      features: {
        whatsappAutomations: 999, // todas as automacoes
        bookingPage: true,
        instagramBioLink: true,
        onlinePayment: true, // checkout online (sinal ou integral)
        financialDashboard: true, // painel financeiro por profissional
        prioritySupport: true, // suporte prioritario via WhatsApp
        recurringAppointments: false,
        paymentSplit: false,
        waitlist: false,
        advancedBI: false,
        retentionReports: false,
      },
      active: true,
      trialDays: 7, // teste gratis
    },
    {
      name: 'Elite',
      description: 'Ideal para estabelecimentos de grande porte ou redes com multiplos profissionais.',
      price: 249.90,
      interval: 'MONTHLY' as const,
      maxProfessionals: 999, // ilimitado
      maxServices: 999, // ilimitado
      maxAppointments: 999999, // ilimitado
      features: {
        whatsappAutomations: 999, // todas as automacoes
        bookingPage: true,
        instagramBioLink: true,
        onlinePayment: true,
        financialDashboard: true,
        prioritySupport: true,
        recurringAppointments: true, // agendamentos recorrentes
        paymentSplit: true, // split de pagamento automatico
        waitlist: true, // lista de espera inteligente
        advancedBI: true, // dashboard avancado (BI)
        retentionReports: true, // relatorios de retencao e produtividade
      },
      active: true,
      trialDays: 0,
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.plan.findFirst({
      where: { name: plan.name },
    });

    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: plan,
      });
      console.log(`Plano "${plan.name}" atualizado`);
    } else {
      await prisma.plan.create({
        data: plan,
      });
      console.log(`Plano "${plan.name}" criado`);
    }
  }

  console.log('Planos criados com sucesso!');
}

seedPlans()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
