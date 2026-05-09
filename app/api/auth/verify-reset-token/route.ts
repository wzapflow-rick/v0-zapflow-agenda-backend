import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/auth/verify-reset-token
// Verifica se o codigo de recuperacao e valido
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, email } = body;

    if (!code || !email) {
      return NextResponse.json(
        { success: false, error: 'Codigo e email sao obrigatorios' },
        { status: 400 }
      );
    }

    // Busca usuario pelo email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Codigo invalido' },
        { status: 400 }
      );
    }

    // Busca token valido do usuario que comeca com o codigo
    const resetToken = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        token: { startsWith: `${code}:` },
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      return NextResponse.json(
        { success: false, error: 'Codigo invalido ou expirado' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Erro ao verificar codigo:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao verificar codigo' },
      { status: 500 }
    );
  }
}
