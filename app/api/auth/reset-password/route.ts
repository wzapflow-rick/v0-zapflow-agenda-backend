import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { resetCodes } from '../forgot-password/route';

// POST /api/auth/reset-password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, phone, password } = body;

    if (!code || !phone || !password) {
      return NextResponse.json(
        { success: false, error: 'Codigo, telefone e senha sao obrigatorios' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Normaliza o telefone
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // Verifica codigo em memoria
    const stored = resetCodes.get(normalizedPhone);

    if (!stored) {
      return NextResponse.json(
        { success: false, error: 'Codigo invalido' },
        { status: 400 }
      );
    }

    if (new Date() > stored.expiresAt) {
      resetCodes.delete(normalizedPhone);
      return NextResponse.json(
        { success: false, error: 'Codigo expirado' },
        { status: 400 }
      );
    }

    if (stored.code !== code) {
      return NextResponse.json(
        { success: false, error: 'Codigo invalido' },
        { status: 400 }
      );
    }

    // Busca usuario pelo telefone
    const user = await prisma.user.findFirst({
      where: { phone: { contains: normalizedPhone.slice(-9) } },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario nao encontrado para este telefone' },
        { status: 400 }
      );
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Atualiza senha
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Remove codigo da memoria
    resetCodes.delete(normalizedPhone);

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
