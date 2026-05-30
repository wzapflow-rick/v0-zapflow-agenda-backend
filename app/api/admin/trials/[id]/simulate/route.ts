import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAdminFromCookies } from "@/lib/admin-auth"

const simulateTrialSchema = z.object({
  daysRemaining: z.number().min(-30).max(30), // Permite valores negativos para simular expirado
})

// PATCH /api/admin/trials/[id]/simulate - Simular dias restantes do trial
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { daysRemaining } = simulateTrialSchema.parse(body)

    // Buscar subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: { user: true, plan: true },
    })

    if (!subscription) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 })
    }

    // Calcular nova data de fim do trial
    const newTrialEndsAt = new Date()
    newTrialEndsAt.setDate(newTrialEndsAt.getDate() + daysRemaining)

    // Atualizar subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id },
      data: {
        trialEndsAt: newTrialEndsAt,
        // Resetar flags de notificação se estamos "voltando no tempo"
        trialNotified3Days: daysRemaining > 3 ? false : subscription.trialNotified3Days,
        trialNotified1Day: daysRemaining > 1 ? false : subscription.trialNotified1Day,
        // Se dias < 0, marcar como expirado
        status: daysRemaining < 0 ? "TRIAL_EXPIRED" : "TRIALING",
      },
      include: { user: true, plan: true },
    })

    return NextResponse.json({
      success: true,
      message: daysRemaining < 0 
        ? `Trial marcado como expirado (${Math.abs(daysRemaining)} dias atrás)`
        : `Trial simulado com ${daysRemaining} dias restantes`,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        trialEndsAt: updatedSubscription.trialEndsAt,
        trialNotified3Days: updatedSubscription.trialNotified3Days,
        trialNotified1Day: updatedSubscription.trialNotified1Day,
        user: {
          id: updatedSubscription.user.id,
          email: updatedSubscription.user.email,
          name: updatedSubscription.user.name,
        },
        plan: {
          id: updatedSubscription.plan.id,
          name: updatedSubscription.plan.name,
        },
      },
    })
  } catch (error) {
    console.error("[Admin Simulate Trial Error]", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
