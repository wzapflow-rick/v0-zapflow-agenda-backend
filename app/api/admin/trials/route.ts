import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAdminSession } from "@/lib/admin-auth"

// GET /api/admin/trials - Listar todos os trials (ativos, expirados, histórico)
export async function GET(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request)
    if (!session.authenticated) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // active, expired, all
    const page = Number(searchParams.get("page")) || 1
    const limit = Number(searchParams.get("limit")) || 20

    // Filtro de status
    let statusFilter: { status?: string; isTrial?: boolean } = {}
    if (status === "active") {
      statusFilter = { status: "TRIALING", isTrial: true }
    } else if (status === "expired") {
      statusFilter = { status: "TRIAL_EXPIRED" }
    } else {
      // all - buscar trials (ativos ou expirados)
      statusFilter = { isTrial: true }
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: statusFilter,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscription.count({
        where: statusFilter,
      }),
    ])

    // Buscar histórico de trial para cada assinatura
    const trialsWithHistory = await Promise.all(
      subscriptions.map(async (sub) => {
        const history = await prisma.trialHistory.findFirst({
          where: {
            userId: sub.userId,
            planId: sub.planId,
          },
        })
        return {
          ...sub,
          trialHistory: history,
        }
      })
    )

    return NextResponse.json({
      trials: trialsWithHistory.map((t) => ({
        id: t.id,
        status: t.status,
        user: t.user,
        plan: t.plan,
        startDate: t.startDate,
        trialEndsAt: t.trialEndsAt,
        trialNotified3Days: t.trialNotified3Days,
        trialNotified1Day: t.trialNotified1Day,
        convertedToPaid: t.trialHistory?.convertedToPaid || false,
        createdAt: t.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("[Admin Trials GET Error]", error)
    return NextResponse.json(
      { error: "Erro ao buscar trials" },
      { status: 500 }
    )
  }
}
