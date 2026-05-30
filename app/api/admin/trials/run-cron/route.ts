import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminFromCookies } from "@/lib/admin-auth"

// POST /api/admin/trials/run-cron - Executar verificação de trials manualmente
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const now = new Date()
    const results = {
      expired: [] as string[],
      notified3Days: [] as string[],
      notified1Day: [] as string[],
    }

    // Buscar todos os trials ativos
    const activeTrials = await prisma.subscription.findMany({
      where: {
        status: "TRIALING",
        isTrial: true,
        trialEndsAt: { not: null },
      },
      include: {
        user: true,
        plan: true,
      },
    })

    for (const subscription of activeTrials) {
      if (!subscription.trialEndsAt) continue

      const trialEndsAt = new Date(subscription.trialEndsAt)
      const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Trial expirou
      if (daysRemaining <= 0) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "TRIAL_EXPIRED" },
        })

        // Criar notificação
        const establishment = await prisma.establishment.findUnique({
          where: { userId: subscription.userId },
        })
        
        if (establishment) {
          await prisma.notification.create({
            data: {
              type: "trial_expired",
              title: "Seu trial expirou",
              message: `Seu período de teste do plano ${subscription.plan.name} terminou. Assine para recuperar o acesso.`,
              establishmentId: establishment.id,
              userId: subscription.userId,
              data: JSON.stringify({ planId: subscription.planId }),
            },
          })
        }

        results.expired.push(subscription.user.email)
      }
      // Faltam 3 dias ou menos (e ainda não notificou)
      else if (daysRemaining <= 3 && !subscription.trialNotified3Days) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { trialNotified3Days: true },
        })

        const establishment = await prisma.establishment.findUnique({
          where: { userId: subscription.userId },
        })
        
        if (establishment) {
          await prisma.notification.create({
            data: {
              type: "trial_ending_soon",
              title: "Seu trial termina em breve",
              message: `Faltam ${daysRemaining} dias para o fim do seu período de teste do plano ${subscription.plan.name}.`,
              establishmentId: establishment.id,
              userId: subscription.userId,
              data: JSON.stringify({ planId: subscription.planId, daysRemaining }),
            },
          })
        }

        results.notified3Days.push(subscription.user.email)
      }
      // Falta 1 dia ou menos (e ainda não notificou)
      else if (daysRemaining <= 1 && !subscription.trialNotified1Day) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { trialNotified1Day: true },
        })

        const establishment = await prisma.establishment.findUnique({
          where: { userId: subscription.userId },
        })
        
        if (establishment) {
          await prisma.notification.create({
            data: {
              type: "trial_ending_tomorrow",
              title: "Último dia do trial!",
              message: `Seu período de teste do plano ${subscription.plan.name} termina amanhã! Assine agora para não perder o acesso.`,
              establishmentId: establishment.id,
              userId: subscription.userId,
              data: JSON.stringify({ planId: subscription.planId }),
            },
          })
        }

        results.notified1Day.push(subscription.user.email)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Verificação de trials executada",
      results: {
        totalChecked: activeTrials.length,
        expired: results.expired.length,
        notified3Days: results.notified3Days.length,
        notified1Day: results.notified1Day.length,
        details: results,
      },
    })
  } catch (error) {
    console.error("[Admin Run Cron Error]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
