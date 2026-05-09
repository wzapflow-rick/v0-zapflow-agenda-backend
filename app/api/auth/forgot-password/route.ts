import { NextRequest, NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Armazena codigos temporarios em memoria (em producao, usar Redis)
// Formato: { "5511999999999": { code: "123456", expiresAt: Date } }
const resetCodes = new Map<string, { code: string; expiresAt: Date }>();

// Envia mensagem via WhatsApp
async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('[WhatsApp] Evolution API nao configurada');
    return false;
  }

  try {
    const instanceName = 'ZapFlow-Sistema';
    
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar mensagem:', error);
    return false;
  }
}

// Exporta para usar nas outras rotas
export { resetCodes };

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

    // Normaliza o telefone - adiciona 55 se nao tiver
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // Gera codigo de 6 digitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salva codigo em memoria
    resetCodes.set(normalizedPhone, { code, expiresAt });

    // Envia codigo via WhatsApp
    const message = `*ZapAgenda - Recuperacao de Senha*\n\nSeu codigo de recuperacao de senha e:\n\n*${code}*\n\nEsse codigo expira em 15 minutos.\n\nSe voce nao solicitou, ignore esta mensagem.`;
    
    const whatsappSent = await sendWhatsAppMessage(normalizedPhone, message);

    return NextResponse.json({
      success: true,
      message: 'Codigo enviado via WhatsApp',
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
