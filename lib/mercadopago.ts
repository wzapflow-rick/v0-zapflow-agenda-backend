import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// Inicializa o cliente do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
});

export const preferenceClient = new Preference(client);
export const paymentClient = new Payment(client);

// Tipos
export interface CreateSubscriptionPreferenceParams {
  planId: string;
  planName: string;
  planPrice: number;
  userId: string;
  userEmail: string;
  userName: string;
}

// Cria uma preferencia de pagamento para assinatura
export async function createSubscriptionPreference(params: CreateSubscriptionPreferenceParams) {
  const { planId, planName, planPrice, userId, userEmail, userName } = params;
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const preference = await preferenceClient.create({
    body: {
      items: [
        {
          id: planId,
          title: `Assinatura ${planName}`,
          description: `Plano ${planName} - ZapAgenda`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: planPrice,
        },
      ],
      payer: {
        email: userEmail,
        name: userName,
      },
      back_urls: {
        success: `${baseUrl}/dashboard/settings/billing?status=success`,
        failure: `${baseUrl}/dashboard/settings/billing?status=failure`,
        pending: `${baseUrl}/dashboard/settings/billing?status=pending`,
      },
      auto_return: 'approved',
      external_reference: JSON.stringify({ userId, planId }),
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      statement_descriptor: 'ZAPAGENDA',
    },
  });

  return preference;
}

// Verifica pagamento pelo ID
export async function getPayment(paymentId: string) {
  try {
    const payment = await paymentClient.get({ id: paymentId });
    return payment;
  } catch (error) {
    console.error('[MercadoPago] Erro ao buscar pagamento:', error);
    return null;
  }
}

// Valida assinatura do webhook (opcional, para maior seguranca)
export function validateWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string
): boolean {
  // Implementar validacao HMAC se necessario
  // Por enquanto, retorna true para simplificar
  return true;
}
