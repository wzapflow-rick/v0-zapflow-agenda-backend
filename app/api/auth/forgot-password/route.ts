import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Envia mensagem via WhatsApp
async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('[WhatsApp] Evolution API nao configurada');
    return false;
  }

  try {
    // Usa uma instancia global para envio de mensagens do sistema
    const instanceName = 'ZapFlow-Sistema';
    
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ''),
        text: message,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar mensagem:', error);
    return false;
  }
}

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Telefone e obrigatorio' },
        { status: 400 }
      );
    }

    // Normaliza o telefone (remove caracteres nao numericos)
    const normalizedPhone = phone.replace(/\D/g, '');

    // Busca usuario pelo telefone
    const user = await prisma.user.findFirst({
      where: { phone: { contains: normalizedPhone.slice(-9) } },
      select: { id: true, name: true, phone: true },
    });

    // Sempre retorna sucesso para nao revelar se o telefone existe
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Se o numero existir, voce recebera um codigo via WhatsApp',
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

    // Gera codigo de 6 digitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salva token no banco
    await prisma.passwordReset.create({
      data: {
        token: `${code}:${token}`,
        userId: user.id,
        expiresAt,
      },
    });

    // Envia codigo via WhatsApp
    const message = `*ZapAgenda - Recuperacao de Senha*\n\nOla ${user.name || ''}!\n\nSeu codigo de recuperacao de senha e:\n\n*${code}*\n\nEsse codigo expira em 15 minutos.\n\nSe voce nao solicitou, ignore esta mensagem.`;
    
    const whatsappSent = await sendWhatsAppMessage(user.phone!, message);

    return NextResponse.json({
      success: true,
      message: 'Se o numero existir, voce recebera um codigo via WhatsApp',
      sent: whatsappSent,
    });
  } catch (error) {
    console.error('Erro ao solicitar recuperacao de senha:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar solicitacao' },
      { status: 500 }
    );
  }
}
