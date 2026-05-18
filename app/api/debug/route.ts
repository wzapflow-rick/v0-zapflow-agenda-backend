import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/debug - Diagnostico do banco de dados
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    // Protege a rota em producao
    if (process.env.NODE_ENV === 'production' && secret !== 'zapagenda-debug-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const diagnostics: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: {
        connected: false,
        url: process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET',
      },
      tables: {},
    };

    // Testa conexao com o banco
    try {
      await prisma.$queryRaw`SELECT 1`;
      diagnostics.database = {
        ...diagnostics.database as object,
        connected: true,
      };
    } catch (dbError) {
      diagnostics.database = {
        ...diagnostics.database as object,
        connected: false,
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
      };
      return NextResponse.json(diagnostics);
    }

    // Verifica tabela plans
    try {
      const plansCount = await prisma.plan.count();
      const plans = await prisma.plan.findMany({
        select: {
          id: true,
          name: true,
          price: true,
          active: true,
        },
      });
      (diagnostics.tables as Record<string, unknown>).plans = {
        exists: true,
        count: plansCount,
        data: plans,
      };
    } catch (error) {
      (diagnostics.tables as Record<string, unknown>).plans = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Verifica tabela users
    try {
      const usersCount = await prisma.user.count();
      (diagnostics.tables as Record<string, unknown>).users = {
        exists: true,
        count: usersCount,
        hasPasswordColumn: true, // Se chegou aqui, a coluna existe
      };
    } catch (error) {
      (diagnostics.tables as Record<string, unknown>).users = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Verifica tabela establishments
    try {
      const establishmentsCount = await prisma.establishment.count();
      (diagnostics.tables as Record<string, unknown>).establishments = {
        exists: true,
        count: establishmentsCount,
      };
    } catch (error) {
      (diagnostics.tables as Record<string, unknown>).establishments = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Verifica schema das tabelas usando query raw
    try {
      const plansColumns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'plans'
        ORDER BY ordinal_position
      `;
      (diagnostics.tables as Record<string, unknown>).plansSchema = plansColumns;
    } catch {
      // Ignora erro de schema
    }

    try {
      const usersColumns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `;
      (diagnostics.tables as Record<string, unknown>).usersSchema = usersColumns;
    } catch {
      // Ignora erro de schema
    }

    return NextResponse.json(diagnostics, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Erro no diagnostico:', error);
    return NextResponse.json(
      { 
        error: 'Erro no diagnostico',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
