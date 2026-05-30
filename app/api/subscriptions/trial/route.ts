import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { authenticate, isAuthError } from "@/lib/auth"

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
    console.log("[v0] POST /api/subscriptions/trial - Iniciando...")
    
    const authResult = await authenticate(request)
    if (isAuthError(authResult)) {
      console.log("[v0] Erro de autenticação")
      return authResult
    }
    const userId = authResult.id
    console.log("[v0] userId:", userId)

    const body = await request.json()
    console.log("[v0] Body recebido:", JSON.stringify(body))
    const { planId } = startTrialSchema.parse(body)
    console.log("[v0] planId validado:", planId)

    // Verificar se trial está habilitado globalmente
    const trialEnabledGlobal = await prisma.appSettings.findUnique({
      where: { key: "trial_enabled_global" },
    })
    console.log("[v0] trialEnabledGlobal:", trialEnabledGlobal?.value)
    
    if (trialEnabledGlobal?.value !== "true") {
      console.log("[v0] Trial desabilitado globalmente")
      return NextResponse.json(
        { error: "Trial está desabilitado no momento" },
        { status: 400 }
      )
    }

    // Buscar o plano
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })
    console.log("[v0] Plano encontrado:", plan?.name, "trialEnabled:", plan?.trialEnabled)

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
    console.log("[v0] existingTrialForPlan:", existingTrialForPlan)

    if (existingTrialForPlan) {
      console.log("[v0] BLOQUEADO: Já existe trial para este plano")
      return NextResponse.json(
        { error: "Você já utilizou o trial para este plano" },
        { status: 400 }
      )
    }

    // Verificar se já fez trial de algum plano (e não pagou depois)
    const anyExistingTrial = await prisma.trialHistory.findFirst({
      where: { userId },
    })
    console.log("[v0] anyExistingTrial:", anyExistingTrial)

    if (anyExistingTrial) {
      console.log("[v0] Usuário já fez trial antes, verificando se pagou...")
      // Verificar se já pagou algum plano
      const hasPaidBefore = await prisma.subscription.findFirst({
        where: {
          userId,
          status: "ACTIVE",
          isTrial: false,
        },
      })
      console.log("[v0] hasPaidBefore:", hasPaidBefore)

      if (!hasPaidBefore) {
        console.log("[v0] BLOQUEADO: Já fez trial e nunca pagou")
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
    console.log("[v0] trialDays:", trialDays, "trialEndsAt:", trialEndsAt)

    // Usar transação para garantir atomicidade
    console.log("[v0] Iniciando transação para criar subscription e trial_history...")
    const result = await prisma.$transaction(async (tx) => {
      console.log("[v0] Dentro da transação - criando/atualizando subscription...")
      // Criar ou atualizar assinatura em trial
      const subscription = await tx.subscription.upsert({
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
      console.log("[v0] Subscription criada/atualizada:", subscription.id, subscription.status)

      // Registrar no histórico de trials
      console.log("[v0] Criando trial_history...")
      await tx.trialHistory.create({
        data: {
          userId,
          planId,
          startedAt: new Date(),
        },
      })
      console.log("[v0] trial_history criado com sucesso!")

      return subscription
    })
    console.log("[v0] Transação completada com sucesso!")

    return NextResponse.json({
      success: true,
      message: `Trial de ${trialDays} dias iniciado com sucesso!`,
      subscription: {
        id: result.id,
        status: result.status,
        planId: result.planId,
        trialEndsAt: result.trialEndsAt,
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
