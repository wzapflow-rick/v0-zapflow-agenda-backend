import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { verifyAdminSession } from "@/lib/admin-auth"

const updatePlanTrialSchema = z.object({
  trialEnabled: z.boolean().optional(),
  trialDays: z.number().min(1).max(90).optional(),
})

// GET /api/admin/plans/[id]/trial - Buscar configurações de trial do plano
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAdminSession(request)
    if (!session.authenticated) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const plan = await prisma.plan.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        trialEnabled: true,
        trialDaysConfig: true,
      },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 })
    }

    // Buscar estatísticas de trial deste plano
    const [activeTrials, totalTrials, convertedTrials] = await Promise.all([
      prisma.subscription.count({
        where: { planId: id, status: "TRIALING", isTrial: true },
      }),
      prisma.trialHistory.count({
        where: { planId: id },
      }),
      prisma.trialHistory.count({
        where: { planId: id, convertedToPaid: true },
      }),
    ])

    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        trialEnabled: plan.trialEnabled,
        trialDays: plan.trialDaysConfig,
      },
      stats: {
        activeTrials,
        totalTrials,
        convertedTrials,
        conversionRate: totalTrials > 0
          ? ((convertedTrials / totalTrials) * 100).toFixed(1)
          : "0",
      },
    })
  } catch (error) {
    console.error("[Admin Plan Trial GET Error]", error)
    return NextResponse.json(
      { error: "Erro ao buscar configurações de trial do plano" },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/plans/[id]/trial - Atualizar configurações de trial do plano
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAdminSession(request)
    if (!session.authenticated) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const plan = await prisma.plan.findUnique({
      where: { id },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 })
    }

    const body = await request.json()
    const data = updatePlanTrialSchema.parse(body)

    const updatedPlan = await prisma.plan.update({
      where: { id },
      data: {
        trialEnabled: data.trialEnabled ?? plan.trialEnabled,
        trialDaysConfig: data.trialDays ?? plan.trialDaysConfig,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Configurações de trial do plano ${plan.name} atualizadas`,
      plan: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        trialEnabled: updatedPlan.trialEnabled,
        trialDays: updatedPlan.trialDaysConfig,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    console.error("[Admin Plan Trial PATCH Error]", error)
    return NextResponse.json(
      { error: "Erro ao atualizar configurações de trial do plano" },
      { status: 500 }
    )
  }
}
