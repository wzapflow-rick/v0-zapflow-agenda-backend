import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { verifyAdminSession } from "@/lib/admin-auth"

const updateTrialSettingsSchema = z.object({
  trialEnabledGlobal: z.boolean().optional(),
  trialDaysGlobal: z.number().min(1).max(90).optional(),
  notifyBefore3Days: z.boolean().optional(),
  notifyBefore1Day: z.boolean().optional(),
})

// GET /api/admin/settings/trial - Buscar configurações de trial
export async function GET(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request)
    if (!session.authenticated) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const settings = await prisma.appSettings.findMany({
      where: {
        key: {
          in: [
            "trial_enabled_global",
            "trial_days_global",
            "trial_notify_3_days",
            "trial_notify_1_day",
          ],
        },
      },
    })

    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value
      return acc
    }, {} as Record<string, string | null>)

    // Buscar estatísticas de trial
    const [
      activeTrials,
      expiredTrials,
      convertedTrials,
      totalTrialHistory,
    ] = await Promise.all([
      prisma.subscription.count({
        where: { status: "TRIALING", isTrial: true },
      }),
      prisma.subscription.count({
        where: { status: "TRIAL_EXPIRED" },
      }),
      prisma.trialHistory.count({
        where: { convertedToPaid: true },
      }),
      prisma.trialHistory.count(),
    ])

    return NextResponse.json({
      settings: {
        trialEnabledGlobal: settingsMap["trial_enabled_global"] === "true",
        trialDaysGlobal: Number(settingsMap["trial_days_global"]) || 7,
        notifyBefore3Days: settingsMap["trial_notify_3_days"] === "true",
        notifyBefore1Day: settingsMap["trial_notify_1_day"] === "true",
      },
      stats: {
        activeTrials,
        expiredTrials,
        convertedTrials,
        totalTrialHistory,
        conversionRate: totalTrialHistory > 0 
          ? ((convertedTrials / totalTrialHistory) * 100).toFixed(1) 
          : "0",
      },
    })
  } catch (error) {
    console.error("[Admin Trial Settings GET Error]", error)
    return NextResponse.json(
      { error: "Erro ao buscar configurações de trial" },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/settings/trial - Atualizar configurações de trial
export async function PATCH(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request)
    if (!session.authenticated) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const data = updateTrialSettingsSchema.parse(body)

    const updates: { key: string; value: string }[] = []

    if (data.trialEnabledGlobal !== undefined) {
      updates.push({
        key: "trial_enabled_global",
        value: String(data.trialEnabledGlobal),
      })
    }

    if (data.trialDaysGlobal !== undefined) {
      updates.push({
        key: "trial_days_global",
        value: String(data.trialDaysGlobal),
      })
    }

    if (data.notifyBefore3Days !== undefined) {
      updates.push({
        key: "trial_notify_3_days",
        value: String(data.notifyBefore3Days),
      })
    }

    if (data.notifyBefore1Day !== undefined) {
      updates.push({
        key: "trial_notify_1_day",
        value: String(data.notifyBefore1Day),
      })
    }

    // Atualizar cada configuração
    for (const update of updates) {
      await prisma.appSettings.upsert({
        where: { key: update.key },
        update: { value: update.value },
        create: {
          key: update.key,
          value: update.value,
          description: getSettingDescription(update.key),
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: "Configurações de trial atualizadas com sucesso",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    console.error("[Admin Trial Settings PATCH Error]", error)
    return NextResponse.json(
      { error: "Erro ao atualizar configurações de trial" },
      { status: 500 }
    )
  }
}

function getSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    trial_enabled_global: "Habilita trial globalmente",
    trial_days_global: "Dias de trial padrão",
    trial_notify_3_days: "Notificar 3 dias antes do fim",
    trial_notify_1_day: "Notificar 1 dia antes do fim",
  }
  return descriptions[key] || ""
}
