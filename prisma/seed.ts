import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // Cria planos de assinatura
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { id: 'plan-free' },
      update: {},
      create: {
        id: 'plan-free',
        name: 'Gratuito',
        description: 'Ideal para começar',
        price: 0,
        interval: 'MONTHLY',
        maxProfessionals: 1,
        maxServices: 5,
        maxAppointments: 50,
        features: [
          '1 profissional',
          '5 serviços',
          '50 agendamentos/mês',
          'Página de agendamento online',
        ],
      },
    }),
    prisma.plan.upsert({
      where: { id: 'plan-starter' },
      update: {},
      create: {
        id: 'plan-starter',
        name: 'Starter',
        description: 'Para pequenos negócios',
        price: 49.90,
        interval: 'MONTHLY',
        maxProfessionals: 3,
        maxServices: 15,
        maxAppointments: 200,
        features: [
          'Até 3 profissionais',
          '15 serviços',
          '200 agendamentos/mês',
          'Página de agendamento online',
          'Lembretes por email',
          'Suporte por email',
        ],
      },
    }),
    prisma.plan.upsert({
      where: { id: 'plan-pro' },
      update: {},
      create: {
        id: 'plan-pro',
        name: 'Profissional',
        description: 'Para negócios em crescimento',
        price: 99.90,
        interval: 'MONTHLY',
        maxProfessionals: 10,
        maxServices: 50,
        maxAppointments: 1000,
        features: [
          'Até 10 profissionais',
          '50 serviços',
          '1000 agendamentos/mês',
          'Página de agendamento online',
          'Lembretes por email e SMS',
          'Relatórios avançados',
          'Suporte prioritário',
        ],
      },
    }),
    prisma.plan.upsert({
      where: { id: 'plan-enterprise' },
      update: {},
      create: {
        id: 'plan-enterprise',
        name: 'Enterprise',
        description: 'Para grandes estabelecimentos',
        price: 199.90,
        interval: 'MONTHLY',
        maxProfessionals: 999,
        maxServices: 999,
        maxAppointments: 99999,
        features: [
          'Profissionais ilimitados',
          'Serviços ilimitados',
          'Agendamentos ilimitados',
          'Página de agendamento online',
          'Lembretes por email e SMS',
          'Relatórios avançados',
          'API personalizada',
          'Suporte dedicado',
        ],
      },
    }),
  ]);

  console.log(`Criados ${plans.length} planos de assinatura`);

  // Cria um usuário de teste com estabelecimento
  const hashedPassword = await bcrypt.hash('123456', 10);

  const testUser = await prisma.user.upsert({
    where: { email: 'teste@exemplo.com' },
    update: {},
    create: {
      email: 'teste@exemplo.com',
      password: hashedPassword,
      name: 'Usuário de Teste',
      phone: '11999999999',
      establishment: {
        create: {
          name: 'Barbearia do João',
          slug: 'barbearia-do-joao',
          description: 'A melhor barbearia da cidade',
          address: 'Rua Exemplo, 123 - Centro',
          phone: '11999999999',
          email: 'contato@barbearia.com',
          businessHours: {
            monday: { open: '09:00', close: '18:00', enabled: true },
            tuesday: { open: '09:00', close: '18:00', enabled: true },
            wednesday: { open: '09:00', close: '18:00', enabled: true },
            thursday: { open: '09:00', close: '18:00', enabled: true },
            friday: { open: '09:00', close: '18:00', enabled: true },
            saturday: { open: '09:00', close: '13:00', enabled: true },
            sunday: { open: '09:00', close: '18:00', enabled: false },
          },
          slotDuration: 30,
        },
      },
    },
    include: {
      establishment: true,
    },
  });

  console.log(`Usuário de teste criado: ${testUser.email}`);

  if (testUser.establishment) {
    // Cria profissionais de teste
    const professionals = await Promise.all([
      prisma.professional.upsert({
        where: { id: 'prof-1' },
        update: {},
        create: {
          id: 'prof-1',
          name: 'João Silva',
          email: 'joao@barbearia.com',
          phone: '11999999001',
          bio: 'Barbeiro com 10 anos de experiência',
          establishmentId: testUser.establishment.id,
        },
      }),
      prisma.professional.upsert({
        where: { id: 'prof-2' },
        update: {},
        create: {
          id: 'prof-2',
          name: 'Pedro Santos',
          email: 'pedro@barbearia.com',
          phone: '11999999002',
          bio: 'Especialista em cortes modernos',
          establishmentId: testUser.establishment.id,
        },
      }),
    ]);

    console.log(`Criados ${professionals.length} profissionais`);

    // Cria serviços de teste
    const services = await Promise.all([
      prisma.service.upsert({
        where: { id: 'serv-1' },
        update: {},
        create: {
          id: 'serv-1',
          name: 'Corte de Cabelo',
          description: 'Corte masculino tradicional ou moderno',
          duration: 30,
          price: 35.00,
          establishmentId: testUser.establishment.id,
        },
      }),
      prisma.service.upsert({
        where: { id: 'serv-2' },
        update: {},
        create: {
          id: 'serv-2',
          name: 'Barba',
          description: 'Barba feita com navalha e toalha quente',
          duration: 20,
          price: 25.00,
          establishmentId: testUser.establishment.id,
        },
      }),
      prisma.service.upsert({
        where: { id: 'serv-3' },
        update: {},
        create: {
          id: 'serv-3',
          name: 'Corte + Barba',
          description: 'Combo corte de cabelo e barba',
          duration: 45,
          price: 55.00,
          establishmentId: testUser.establishment.id,
        },
      }),
    ]);

    console.log(`Criados ${services.length} serviços`);

    // Associa profissionais aos serviços
    for (const professional of professionals) {
      for (const service of services) {
        await prisma.professionalService.upsert({
          where: {
            professionalId_serviceId: {
              professionalId: professional.id,
              serviceId: service.id,
            },
          },
          update: {},
          create: {
            professionalId: professional.id,
            serviceId: service.id,
          },
        });
      }
    }

    console.log('Profissionais associados aos serviços');

    // Cria clientes de teste
    const clients = await Promise.all([
      prisma.client.upsert({
        where: {
          phone_establishmentId: {
            phone: '11988888001',
            establishmentId: testUser.establishment.id,
          },
        },
        update: {},
        create: {
          name: 'Carlos Oliveira',
          email: 'carlos@email.com',
          phone: '11988888001',
          establishmentId: testUser.establishment.id,
        },
      }),
      prisma.client.upsert({
        where: {
          phone_establishmentId: {
            phone: '11988888002',
            establishmentId: testUser.establishment.id,
          },
        },
        update: {},
        create: {
          name: 'Maria Santos',
          email: 'maria@email.com',
          phone: '11988888002',
          establishmentId: testUser.establishment.id,
        },
      }),
    ]);

    console.log(`Criados ${clients.length} clientes`);
  }

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
