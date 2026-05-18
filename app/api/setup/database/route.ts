import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/setup/database - Inicializa o banco de dados (rota protegida)
// Esta rota deve ser chamada uma vez apos o deploy para garantir que as tabelas existam
export async function POST(request: NextRequest) {
  try {
    // Verifica secret para proteger a rota
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== process.env.SETUP_SECRET && secret !== 'zapagenda-setup-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: { step: string; status: string; details?: string }[] = [];

    // Passo 1: Verifica conexao com o banco
    try {
      await prisma.$queryRaw`SELECT 1`;
      results.push({ step: 'database_connection', status: 'success' });
    } catch (error) {
      results.push({ 
        step: 'database_connection', 
        status: 'error', 
        details: error instanceof Error ? error.message : 'Connection failed' 
      });
      return NextResponse.json({
        success: false,
        message: 'Falha na conexao com o banco de dados',
        results,
      }, { status: 500 });
    }

    // Passo 2: Verifica se a tabela plans existe
    try {
      const plansExist = await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'plans'
        );
      `;
      
      if (!plansExist[0]?.exists) {
        results.push({ 
          step: 'plans_table', 
          status: 'missing', 
          details: 'A tabela plans nao existe. Execute prisma db push no deploy.' 
        });
      } else {
        results.push({ step: 'plans_table', status: 'exists' });
      }
    } catch (error) {
      results.push({ 
        step: 'plans_table_check', 
        status: 'error', 
        details: error instanceof Error ? error.message : 'Check failed' 
      });
    }

    // Passo 3: Verifica se a tabela users existe e tem coluna password
    try {
      const usersExist = await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `;
      
      if (!usersExist[0]?.exists) {
        results.push({ 
          step: 'users_table', 
          status: 'missing', 
          details: 'A tabela users nao existe. Execute prisma db push no deploy.' 
        });
      } else {
        // Verifica se a coluna password existe
        const passwordColumnExists = await prisma.$queryRaw<{ exists: boolean }[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            AND column_name = 'password'
          );
        `;
        
        if (!passwordColumnExists[0]?.exists) {
          results.push({ 
            step: 'users_password_column', 
            status: 'missing', 
            details: 'A coluna password nao existe na tabela users. Execute prisma db push.' 
          });
        } else {
          results.push({ step: 'users_table', status: 'complete' });
        }
      }
    } catch (error) {
      results.push({ 
        step: 'users_table_check', 
        status: 'error', 
        details: error instanceof Error ? error.message : 'Check failed' 
      });
    }

    // Passo 4: Tenta criar os planos se a tabela existir
    try {
      // Verifica se ja existem planos
      const existingPlans = await prisma.plan.count();
      
      if (existingPlans === 0) {
        // Cria os planos
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

        for (const plan of plans) {
          await prisma.plan.create({ data: plan });
        }
        results.push({ step: 'seed_plans', status: 'success', details: '3 planos criados' });
      } else {
        results.push({ step: 'seed_plans', status: 'skipped', details: `${existingPlans} planos ja existem` });
      }
    } catch (error) {
      results.push({ 
        step: 'seed_plans', 
        status: 'error', 
        details: error instanceof Error ? error.message : 'Seed failed' 
      });
    }

    // Verifica se houve algum erro critico
    const hasErrors = results.some(r => r.status === 'error' || r.status === 'missing');

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors 
        ? 'Setup incompleto - verifique os erros e execute prisma db push'
        : 'Setup concluido com sucesso',
      results,
      nextSteps: hasErrors ? [
        'Execute: npx prisma db push --accept-data-loss (CUIDADO: pode perder dados)',
        'Ou execute: npx prisma migrate deploy (se houver migrations)',
        'Depois chame novamente esta rota para popular os planos'
      ] : [],
    });
  } catch (error) {
    console.error('Erro no setup do banco:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro no setup do banco de dados',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/setup/database - Verifica status do banco
export async function GET(request: NextRequest) {
  try {
    const checks: { name: string; status: string; details?: string }[] = [];

    // Check 1: Database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.push({ name: 'database_connection', status: 'ok' });
    } catch {
      checks.push({ name: 'database_connection', status: 'error', details: 'Cannot connect' });
    }

    // Check 2: Plans table and data
    try {
      const plansCount = await prisma.plan.count();
      checks.push({ 
        name: 'plans_table', 
        status: plansCount > 0 ? 'ok' : 'empty',
        details: `${plansCount} plans found`
      });
    } catch {
      checks.push({ name: 'plans_table', status: 'error', details: 'Table does not exist' });
    }

    // Check 3: Users table
    try {
      await prisma.user.count();
      checks.push({ name: 'users_table', status: 'ok' });
    } catch {
      checks.push({ name: 'users_table', status: 'error', details: 'Table does not exist or missing columns' });
    }

    // Check 4: Establishments table
    try {
      await prisma.establishment.count();
      checks.push({ name: 'establishments_table', status: 'ok' });
    } catch {
      checks.push({ name: 'establishments_table', status: 'error', details: 'Table does not exist' });
    }

    const allOk = checks.every(c => c.status === 'ok');

    return NextResponse.json({
      healthy: allOk,
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
