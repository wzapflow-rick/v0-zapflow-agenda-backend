import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email e obrigatorio' },
        { status: 400 }
      );
    }

    // Busca usuario pelo email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Sempre retorna sucesso para nao revelar se o email existe
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Se o email existir, voce recebera um link para redefinir sua senha',
      });
    }

    // Invalida tokens anteriores
    await prisma.passwordReset.updateMany({
      where: { 
        userId: user.id,
        used: false,
      },
      data: { used: true },
    });

    // Gera novo token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Salva token no banco
    await prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // TODO: Enviar email com o link de recuperacao
    // Por enquanto, retorna o token para testes (remover em producao)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    return NextResponse.json({
      success: true,
      message: 'Se o email existir, voce recebera um link para redefinir sua senha',
      // Remover em producao - apenas para desenvolvimento/testes
      ...(process.env.NODE_ENV === 'development' && { 
        debug: { token, resetUrl } 
      }),
    });
  } catch (error) {
    console.error('Erro ao solicitar recuperacao de senha:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar solicitacao' },
      { status: 500 }
    );
  }
}
