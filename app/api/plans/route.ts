import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { success, handleError } from '@/lib/api-utils';

// GET /api/plans - Listar planos disponiveis
export async function GET(request: NextRequest) {
  try {
    console.log('[v0] GET /api/plans - Iniciando busca de planos...');
    
    // Testa conexao com o banco primeiro
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('[v0] Conexao com banco OK');
    } catch (dbError) {
      console.error('[v0] Erro de conexao com banco:', dbError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed',
          details: dbError instanceof Error ? dbError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Busca planos
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });

    console.log(`[v0] Encontrados ${plans.length} planos ativos`);

    // Se nao encontrou planos, retorna array vazio mas com status 200
    if (plans.length === 0) {
      console.log('[v0] Nenhum plano encontrado - tabela pode estar vazia');
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Nenhum plano cadastrado. Execute POST /api/plans/seed?secret=zapagenda2024 para criar os planos.',
      });
    }

    return success(plans);
  } catch (error) {
    console.error('[v0] Erro ao buscar planos:', error);
    
    // Retorna erro detalhado para debug
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch plans',
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        { status: 500 }
      );
    }
    
    return handleError(error);
  }
}
