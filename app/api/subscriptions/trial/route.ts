import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { authenticate, isAuthError } from "@/lib/auth"
import { auditLog } from "@/lib/api-utils"

const startTrialSchema = z.object({
  planId: z.string().min(1, "Plan ID é obrigatório"),
})

// GET /api/subscriptions/trial - Verificar se usuário pode fazer trial
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request)
    if (isAuthError(authResult)) return authResult
    const userId = authResult.id

    // Buscar configuração global de trial
    const trialEnabledGlobal = await prisma.appSettings.findUnique({
      where: { key: "trial_enabled_global" },
    })
    
    if (trialEnabledGlobal?.value !== "true") {
      return NextResponse.json({
        canTrial: false,
        reason: "Trial está desabilitado globalmente",
      })
    }

    // Verificar se usuário já fez algum trial
    const existingTrial = await prisma.trialHistory.findFirst({
      where: { userId },
      include: { plan: true },
    })

    if (existingTrial) {
      // Verificar se usuário já pagou algum plano
      const paidSubscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: "ACTIVE",
          isTrial: false,
        },
        include: { plan: true },
      })

      if (paidSubscription) {
        // Se já pagou, pode testar plano SUPERIOR
        const currentPlanPrice = Number(paidSubscription.plan.price)
        
        // Buscar planos disponíveis para trial (superiores ao atual)
        const availablePlans = await prisma.plan.findMany({
          where: {
            active: true,
            trialEnabled: true,
            price: { gt: currentPlanPrice },
            id: {
              notIn: (await prisma.trialHistory.findMany({
                where: { userId },
                select: { planId: true },
              })).map(t => t.planId),
            },
          },
          orderBy: { price: "asc" },
        })

        return NextResponse.json({
          canTrial: availablePlans.length > 0,
          reason: availablePlans.length > 0 
            ? "Pode testar plano superior" 
            : "Já testou todos os planos disponíveis",
          availablePlans,
          currentPlan: paidSubscription.plan,
        })
      }

      // Já fez trial e nunca pagou
      return NextResponse.json({
        canTrial: false,
        reason: "Você já utilizou seu trial gratuito",
        trialUsed: {
          planName: existingTrial.plan.name,
          startedAt: existingTrial.startedAt,
          endedAt: existingTrial.endedAt,
        },
      })
    }

    // Nunca fez trial - buscar planos disponíveis
    const availablePlans = await prisma.plan.findMany({
      where: {
        active: true,
        trialEnabled: true,
      },
      orderBy: { price: "asc" },
    })

    return NextResponse.json({
      canTrial: true,
      reason: "Você pode iniciar um trial gratuito",
      availablePlans,
    })
  } catch (error) {
    console.error("[Trial Check Error]", error)
    return NextResponse.json(
      { error: "Erro ao verificar elegibilidade para trial" },
      { status: 500 }
    )
  }
}

// POST /api/subscriptions/trial - Iniciar trial
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticate(request)
    if (isAuthError(authResult)) return authResult
    const userId = authResult.id

    const body = await request.json()
    const { planId } = startTrialSchema.parse(body)

    // Verificar se trial está habilitado globalmente
    const trialEnabledGlobal = await prisma.appSettings.findUnique({
      where: { key: "trial_enabled_global" },
    })
    
    if (trialEnabledGlobal?.value !== "true") {
      return NextResponse.json(
        { error: "Trial está desabilitado no momento" },
        { status: 400 }
      )
    }

    // Buscar o plano
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan || !plan.active) {
      return NextResponse.json(
        { error: "Plano não encontrado ou inativo" },
        { status: 404 }
      )
    }

    if (!plan.trialEnabled) {
      return NextResponse.json(
        { error: "Este plano não oferece trial gratuito" },
        { status: 400 }
      )
    }

    // Verificar se já existe trial para este plano
    const existingTrialForPlan = await prisma.trialHistory.findFirst({
      where: {
        userId,
        planId,
      },
    })

    if (existingTrialForPlan) {
      return NextResponse.json(
        { error: "Você já utilizou o trial para este plano" },
        { status: 400 }
      )
    }

    // Verificar se já fez trial de algum plano (e não pagou depois)
    const anyExistingTrial = await prisma.trialHistory.findFirst({
      where: { userId },
    })

    if (anyExistingTrial) {
      // Verificar se já pagou algum plano
      const hasPaidBefore = await prisma.subscription.findFirst({
        where: {
          userId,
          status: "ACTIVE",
          isTrial: false,
        },
      })

      if (!hasPaidBefore) {
        return NextResponse.json(
          { error: "Você já utilizou seu trial gratuito. Assine um plano para continuar." },
          { status: 400 }
        )
      }

      // Se já pagou, verificar se o plano novo é superior
      const currentSubscription = await prisma.subscription.findFirst({
        where: { userId },
        include: { plan: true },
      })

      if (currentSubscription && Number(plan.price) <= Number(currentSubscription.plan.price)) {
        return NextResponse.json(
          { error: "Você só pode testar planos superiores ao seu plano atual" },
          { status: 400 }
        )
      }
    }

    // Buscar dias de trial (do plano ou global)
    const trialDaysGlobal = await prisma.appSettings.findUnique({
      where: { key: "trial_days_global" },
    })
    const trialDays = plan.trialDaysConfig || Number(trialDaysGlobal?.value) || 7

    // Calcular data de fim do trial
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)

    // Criar ou atualizar assinatura em trial
    const subscription = await prisma.subscription.upsert({
      where: { userId },
      update: {
        planId,
        status: "TRIALING",
        isTrial: true,
        startDate: new Date(),
        trialEndsAt,
        trialNotified3Days: false,
        trialNotified1Day: false,
      },
      create: {
        userId,
        planId,
        status: "TRIALING",
        isTrial: true,
        startDate: new Date(),
        trialEndsAt,
      },
    })

    // Registrar no histórico de trials
    await prisma.trialHistory.create({
      data: {
        userId,
        planId,
        startedAt: new Date(),
      },
    })

    // Audit log
    await auditLog({
      action: "TRIAL_STARTED",
      entityType: "subscription",
      entityId: subscription.id,
      userId,
      details: {
        planId,
        planName: plan.name,
        trialDays,
        trialEndsAt,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Trial de ${trialDays} dias iniciado com sucesso!`,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        trialEndsAt: subscription.trialEndsAt,
      },
      plan: {
        id: plan.id,
        name: plan.name,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    console.error("[Trial Start Error]", error)
    return NextResponse.json(
      { error: "Erro ao iniciar trial" },
      { status: 500 }
    )
  }
}
