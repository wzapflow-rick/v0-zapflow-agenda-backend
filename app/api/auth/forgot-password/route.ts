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
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email e obrigatorio' },
        { status: 400 }
      );
    }

    // Busca usuario pelo email COM telefone
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, phone: true },
    });

    // Sempre retorna sucesso para nao revelar se o email existe
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Se o email existir, voce recebera um codigo para redefinir sua senha',
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

    // Gera codigo de 6 digitos (mais facil de digitar que hash longo)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salva token no banco (guarda o codigo no campo token para verificacao)
    await prisma.passwordReset.create({
      data: {
        token: `${code}:${token}`, // Formato: codigo:token_seguro
        userId: user.id,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    // Envia codigo via WhatsApp se o usuario tiver telefone
    let whatsappSent = false;
    if (user.phone) {
      const message = `*ZapAgenda - Recuperacao de Senha*\n\nOla ${user.name || ''}!\n\nSeu codigo de recuperacao de senha e:\n\n*${code}*\n\nEsse codigo expira em 15 minutos.\n\nSe voce nao solicitou, ignore esta mensagem.`;
      
      whatsappSent = await sendWhatsAppMessage(user.phone, message);
    }

    return NextResponse.json({
      success: true,
      message: 'Se o email existir, voce recebera um codigo para redefinir sua senha',
      sentVia: whatsappSent ? 'whatsapp' : 'none',
      // Para testes - remover em producao
      debug: { code, resetUrl, whatsappSent },
    });
  } catch (error) {
    console.error('Erro ao solicitar recuperacao de senha:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar solicitacao' },
      { status: 500 }
    );
  }
}
