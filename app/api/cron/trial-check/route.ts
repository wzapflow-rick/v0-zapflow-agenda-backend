import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auditLog } from "@/lib/api-utils"

// Endpoint para verificar trials - deve ser chamado via cron job
// GET /api/cron/trial-check?secret=zapagenda2024

export async function GET(request: NextRequest) {
  try {
    // Verificar secret para segurança
    const secret = request.nextUrl.searchParams.get("secret")
    if (secret !== "zapagenda2024") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(now.getDate() + 3)
    
    const oneDayFromNow = new Date()
    oneDayFromNow.setDate(now.getDate() + 1)

    const results = {
      notified3Days: [] as string[],
      notified1Day: [] as string[],
      expired: [] as string[],
      errors: [] as string[],
    }

    // Buscar configurações de notificação
    const notify3DaysEnabled = await prisma.appSettings.findUnique({
      where: { key: "trial_notify_3_days" },
    })
    const notify1DayEnabled = await prisma.appSettings.findUnique({
      where: { key: "trial_notify_1_day" },
    })

    // 1. Notificar trials que acabam em 3 dias
    if (notify3DaysEnabled?.value === "true") {
      const trialsEnding3Days = await prisma.subscription.findMany({
        where: {
          status: "TRIALING",
          isTrial: true,
          trialNotified3Days: false,
          trialEndsAt: {
            lte: threeDaysFromNow,
            gt: oneDayFromNow,
          },
        },
        include: {
          user: true,
          plan: true,
        },
      })

      for (const subscription of trialsEnding3Days) {
        try {
          // Marcar como notificado
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { trialNotified3Days: true },
          })

          // Criar notificação no sistema
          if (subscription.user.establishment) {
            const establishment = await prisma.establishment.findUnique({
              where: { userId: subscription.userId },
            })
            
            if (establishment) {
              await prisma.notification.create({
                data: {
                  type: "trial_ending_3_days",
                  title: "Seu trial está acabando!",
                  message: `Seu período de teste do plano ${subscription.plan.name} termina em 3 dias. Assine agora para não perder acesso às funcionalidades.`,
                  establishmentId: establishment.id,
                  userId: subscription.userId,
                  data: JSON.stringify({
                    planId: subscription.planId,
                    trialEndsAt: subscription.trialEndsAt,
                  }),
                },
              })
            }
          }

          // Log para integração com WhatsApp (você pode adicionar webhook aqui)
          console.log(`[Trial 3 Days] Notificar usuário ${subscription.user.email} - Trial do plano ${subscription.plan.name} acaba em 3 dias`)
          
          results.notified3Days.push(subscription.user.email)
        } catch (err) {
          console.error(`[Trial 3 Days Error] User ${subscription.userId}:`, err)
          results.errors.push(`3days-${subscription.userId}`)
        }
      }
    }

    // 2. Notificar trials que acabam em 1 dia
    if (notify1DayEnabled?.value === "true") {
      const trialsEnding1Day = await prisma.subscription.findMany({
        where: {
          status: "TRIALING",
          isTrial: true,
          trialNotified1Day: false,
          trialEndsAt: {
            lte: oneDayFromNow,
            gt: now,
          },
        },
        include: {
          user: true,
          plan: true,
        },
      })

      for (const subscription of trialsEnding1Day) {
        try {
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
                type: "trial_ending_1_day",
                title: "Último dia do seu trial!",
                message: `Seu período de teste do plano ${subscription.plan.name} termina AMANHÃ. Assine agora para continuar usando todas as funcionalidades.`,
                establishmentId: establishment.id,
                userId: subscription.userId,
                data: JSON.stringify({
                  planId: subscription.planId,
                  trialEndsAt: subscription.trialEndsAt,
                }),
              },
            })
          }

          console.log(`[Trial 1 Day] Notificar usuário ${subscription.user.email} - Trial do plano ${subscription.plan.name} acaba AMANHÃ`)
          
          results.notified1Day.push(subscription.user.email)
        } catch (err) {
          console.error(`[Trial 1 Day Error] User ${subscription.userId}:`, err)
          results.errors.push(`1day-${subscription.userId}`)
        }
      }
    }

    // 3. Expirar trials que já acabaram
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: "TRIALING",
        isTrial: true,
        trialEndsAt: {
          lte: now,
        },
      },
      include: {
        user: true,
        plan: true,
      },
    })

    for (const subscription of expiredTrials) {
      try {
        // Atualizar status para TRIAL_EXPIRED
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "TRIAL_EXPIRED",
            endDate: now,
          },
        })

        // Atualizar histórico de trial
        await prisma.trialHistory.updateMany({
          where: {
            userId: subscription.userId,
            planId: subscription.planId,
            endedAt: null,
          },
          data: {
            endedAt: now,
          },
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
              message: `Seu período de teste do plano ${subscription.plan.name} terminou. Seus dados foram mantidos, assine para recuperar o acesso completo.`,
              establishmentId: establishment.id,
              userId: subscription.userId,
              data: JSON.stringify({
                planId: subscription.planId,
              }),
            },
          })
        }

        // Audit log
        await auditLog({
          action: "TRIAL_EXPIRED",
          severity: "MEDIUM",
          userId: subscription.userId,
          resourceType: "subscription",
          resourceId: subscription.id,
          details: JSON.stringify({
            planId: subscription.planId,
            planName: subscription.plan.name,
          }),
        })

        console.log(`[Trial Expired] Usuário ${subscription.user.email} - Trial do plano ${subscription.plan.name} expirou`)
        
        results.expired.push(subscription.user.email)
      } catch (err) {
        console.error(`[Trial Expire Error] User ${subscription.userId}:`, err)
        results.errors.push(`expire-${subscription.userId}`)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
      summary: {
        notified3Days: results.notified3Days.length,
        notified1Day: results.notified1Day.length,
        expired: results.expired.length,
        errors: results.errors.length,
      },
    })
  } catch (error) {
    console.error("[Trial Cron Error]", error)
    return NextResponse.json(
      { error: "Erro ao processar trials" },
      { status: 500 }
    )
  }
}
