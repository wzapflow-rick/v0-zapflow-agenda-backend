import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// POST /api/auth/reset-password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, email, password } = body;

    if (!code || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Codigo, email e senha sao obrigatorios' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Senha deve ter pelo menos 6 caracteres' },
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
        { success: false, error: 'Token invalido' },
        { status: 400 }
      );
    }

    if (resetToken.used) {
      return NextResponse.json(
        { success: false, error: 'Token ja foi utilizado' },
        { status: 400 }
      );
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Token expirado' },
        { status: 400 }
      );
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Atualiza senha e marca token como usado em uma transacao
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Senha alterada com sucesso',
    });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao redefinir senha' },
      { status: 500 }
    );
  }
}
