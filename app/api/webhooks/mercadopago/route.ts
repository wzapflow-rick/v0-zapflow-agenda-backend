import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPayment } from '@/lib/mercadopago';

// POST /api/webhooks/mercadopago - Webhook do Mercado Pago
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[MercadoPago Webhook] Recebido:', JSON.stringify(body));

    // Mercado Pago envia diferentes tipos de notificacao
    const { type, data } = body;

    if (type === 'payment') {
      const paymentId = data?.id;
      
      if (!paymentId) {
        console.log('[MercadoPago Webhook] Payment ID nao encontrado');
        return NextResponse.json({ received: true });
      }

      // Busca detalhes do pagamento
      const payment = await getPayment(paymentId.toString());
      
      if (!payment) {
        console.log('[MercadoPago Webhook] Pagamento nao encontrado');
        return NextResponse.json({ received: true });
      }

      console.log('[MercadoPago Webhook] Payment status:', payment.status);
      console.log('[MercadoPago Webhook] External reference:', payment.external_reference);

      // Extrai dados do external_reference
      let userId: string | null = null;
      let planId: string | null = null;
      
      try {
        const externalData = JSON.parse(payment.external_reference || '{}');
        userId = externalData.userId;
        planId = externalData.planId;
      } catch {
        console.log('[MercadoPago Webhook] Erro ao parsear external_reference');
      }

      if (!userId || !planId) {
        console.log('[MercadoPago Webhook] userId ou planId nao encontrado');
        return NextResponse.json({ received: true });
      }

      // Atualiza assinatura baseado no status do pagamento
      if (payment.status === 'approved') {
        // Pagamento aprovado - ativa assinatura
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        
        if (!plan) {
          console.log('[MercadoPago Webhook] Plano nao encontrado:', planId);
          return NextResponse.json({ received: true });
        }

        // Calcula data de fim baseado no intervalo do plano
        const startDate = new Date();
        const endDate = new Date();
        if (plan.interval === 'MONTHLY') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }

        await prisma.subscription.upsert({
          where: { userId },
          update: {
            planId,
            status: 'ACTIVE',
            startDate,
            endDate,
            gatewaySubscriptionId: paymentId.toString(),
            cancelledAt: null,
          },
          create: {
            userId,
            planId,
            status: 'ACTIVE',
            startDate,
            endDate,
            gatewaySubscriptionId: paymentId.toString(),
          },
        });

        console.log('[MercadoPago Webhook] Assinatura ativada para usuario:', userId);
      } else if (payment.status === 'pending' || payment.status === 'in_process') {
        // Pagamento pendente
        await prisma.subscription.upsert({
          where: { userId },
          update: {
            planId,
            status: 'INACTIVE',
            gatewaySubscriptionId: paymentId.toString(),
          },
          create: {
            userId,
            planId,
            status: 'INACTIVE',
            gatewaySubscriptionId: paymentId.toString(),
          },
        });

        console.log('[MercadoPago Webhook] Assinatura pendente para usuario:', userId);
      } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
        // Pagamento rejeitado ou cancelado
        const existingSubscription = await prisma.subscription.findUnique({
          where: { userId },
        });

        if (existingSubscription) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
            },
          });
        }

        console.log('[MercadoPago Webhook] Pagamento rejeitado/cancelado para usuario:', userId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[MercadoPago Webhook] Erro:', error);
    // Sempre retorna 200 para o Mercado Pago nao reenviar
    return NextResponse.json({ received: true });
  }
}

// GET para teste
export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint ativo' });
}
