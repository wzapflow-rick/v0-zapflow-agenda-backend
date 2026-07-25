import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RATE_LIMITS, rateLimitExceeded } from '@/lib/rate-limit';
import { auditLog, getRequestInfo } from '@/lib/audit-log';
import { sanitizePhone } from '@/lib/sanitize';
import { sendSystemWhatsAppMessage } from '@/lib/system-whatsapp';

// Armazena codigos temporarios em memoria (em producao, usar Redis)
// Formato: { "5511999999999": { code: "123456", expiresAt: Date, attempts: number } }
const resetCodes = new Map<string, { code: string; expiresAt: Date; attempts: number }>();

// Envia mensagem pela instancia de mensagens gerais configurada no painel admin.
// O nome da instancia NAO fica mais fixo no codigo: ele vem de AppSettings,
// portanto o admin pode corrigi-lo sem novo deploy.
async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const result = await sendSystemWhatsAppMessage(phone, message);

  if (!result.success) {
    console.error(
      `[WhatsApp] Falha ao enviar codigo de recuperacao pela instancia "${result.instanceName}":`,
      result.error
    );
  }

  return result.success;
}

// Exporta para usar nas outras rotas
export { resetCodes };

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - previne abuso
    const rateLimitResult = withRateLimit(request, RATE_LIMITS.forgotPassword, 'forgot');
    if (rateLimitResult) {
      return rateLimitExceeded(rateLimitResult);
    }

    const body = await request.json();
    const { phone } = body;
    const { ipAddress, userAgent } = getRequestInfo(request);

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Telefone e obrigatorio' },
        { status: 400 }
      );
    }

    // Sanitiza e normaliza o telefone
    let normalizedPhone = sanitizePhone(phone);
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // Gera codigo de 6 digitos (usando crypto para maior seguranca)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salva codigo em memoria com contador de tentativas
    resetCodes.set(normalizedPhone, { code, expiresAt, attempts: 0 });

    // Log da solicitacao
    await auditLog({
      action: 'PASSWORD_RESET_REQUEST',
      ipAddress,
      userAgent,
      details: { phone: normalizedPhone.slice(0, 4) + '****' + normalizedPhone.slice(-2) },
    });

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
