import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/auth/verify-reset-token
// Verifica se o codigo de recuperacao e valido
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, phone } = body;

    if (!code || !phone) {
      return NextResponse.json(
        { success: false, error: 'Codigo e telefone sao obrigatorios' },
        { status: 400 }
      );
    }

    // Normaliza o telefone
    const normalizedPhone = phone.replace(/\D/g, '');

    // Busca usuario pelo telefone
    const user = await prisma.user.findFirst({
      where: { phone: { contains: normalizedPhone.slice(-9) } },
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
