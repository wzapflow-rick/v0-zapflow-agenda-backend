import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPayment } from '@/lib/mercadopago';

// POST /api/webhooks/mercadopago - Webhook do Mercado Pago
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[MercadoPago Webhook] Recebido:', JSON.stringify(body));

    // Extrair ID do evento para idempotencia
    const eventId = body.id?.toString() || body.data?.id?.toString() || `${Date.now()}-${Math.random()}`;
    const eventType = body.type || 'unknown';

    // 1. PERSISTIR EVENTO ANTES DE QUALQUER PROCESSAMENTO
    // Isso garante que não perdemos eventos mesmo se o processamento falhar
    try {
      await prisma.webhookEvent.create({
        data: {
          eventId,
          eventType,
          payload: body,
          status: 'RECEIVED',
        },
      });
    } catch (error) {
      // Se der erro de constraint única, o evento já foi processado
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        console.log('[MercadoPago Webhook] Evento duplicado ignorado:', eventId);
        return NextResponse.json({ received: true });
      }
      // Outros erros de persistência - logar mas continuar
      console.error('[MercadoPago Webhook] Erro ao persistir evento:', error);
    }

    // 2. PROCESSAR EVENTO
    try {
      await processWebhookEvent(body, eventId);
      
      // Atualizar status para processado
      await prisma.webhookEvent.update({
        where: { eventId },
        data: { 
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    } catch (error) {
      // Salvar erro para análise posterior
      await prisma.webhookEvent.update({
        where: { eventId },
        data: { 
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        },
      }).catch(() => {}); // Ignorar erro de update
      
      console.error('[MercadoPago Webhook] Erro no processamento:', error);
    }

    // 3. SEMPRE RETORNAR 200 PARA O MERCADO PAGO
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[MercadoPago Webhook] Erro fatal:', error);
    // Mesmo com erro fatal, retornar 200 para evitar retentativas infinitas
    return NextResponse.json({ received: true });
  }
}

// Função de processamento separada para facilitar testes
async function processWebhookEvent(body: Record<string, unknown>, eventId: string) {
  const { type, data } = body as { type?: string; data?: { id?: string | number } };

  if (type !== 'payment') {
    console.log('[MercadoPago Webhook] Tipo ignorado:', type);
    return;
  }

  const paymentId = data?.id;
  
  if (!paymentId) {
    console.log('[MercadoPago Webhook] Payment ID nao encontrado');
    return;
  }

  // Busca detalhes do pagamento
  const payment = await getPayment(paymentId.toString());
  
  if (!payment) {
    console.log('[MercadoPago Webhook] Pagamento nao encontrado');
    return;
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
    return;
  }

  if (!userId || !planId) {
    console.log('[MercadoPago Webhook] userId ou planId nao encontrado');
    return;
  }

  // Atualiza assinatura baseado no status do pagamento
  if (payment.status === 'approved') {
    // Pagamento aprovado - ativa assinatura
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    
    if (!plan) {
      console.log('[MercadoPago Webhook] Plano nao encontrado:', planId);
      return;
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
        isTrial: false, // Não é mais trial após pagamento
        startDate,
        endDate,
        gatewaySubscriptionId: paymentId.toString(),
        cancelledAt: null,
        trialEndsAt: null, // Limpa data do trial
      },
      create: {
        userId,
        planId,
        status: 'ACTIVE',
        isTrial: false,
        startDate,
        endDate,
        gatewaySubscriptionId: paymentId.toString(),
      },
    });

    // Atualizar histórico de trial se existir
    await prisma.trialHistory.updateMany({
      where: { userId, planId, convertedToPaid: false },
      data: { 
        convertedToPaid: true,
        endedAt: new Date(),
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

// GET para teste
export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint ativo' });
}
