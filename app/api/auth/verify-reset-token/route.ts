import { NextRequest, NextResponse } from 'next/server';
import { resetCodes } from '../forgot-password/route';

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
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // Busca codigo em memoria
    const stored = resetCodes.get(normalizedPhone);

    if (!stored) {
      return NextResponse.json(
        { success: false, error: 'Codigo invalido' },
        { status: 400 }
      );
    }

    // Verifica se expirou
    if (new Date() > stored.expiresAt) {
      resetCodes.delete(normalizedPhone);
      return NextResponse.json(
        { success: false, error: 'Codigo expirado' },
        { status: 400 }
      );
    }

    // Verifica se o codigo esta correto
    if (stored.code !== code) {
      return NextResponse.json(
        { success: false, error: 'Codigo invalido' },
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
