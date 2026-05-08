import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/auth/verify-reset-token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token e obrigatorio' },
        { status: 400 }
      );
    }

    // Busca token no banco
    const resetToken = await prisma.passwordReset.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
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

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        email: resetToken.user.email,
        name: resetToken.user.name,
      },
    });
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao verificar token' },
      { status: 500 }
    );
  }
}
