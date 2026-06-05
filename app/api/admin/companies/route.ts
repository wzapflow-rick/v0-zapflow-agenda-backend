import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromCookies } from '@/lib/admin-auth'
import prisma from '@/lib/prisma'

// GET /api/admin/companies - Lista todas as empresas com assinatura
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status') || ''
    const planId = searchParams.get('planId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const skip = (page - 1) * limit

    // Monta filtros
    const where: Record<string, unknown> = {}

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    // Filtro por status e plano sao aplicados na subscription
    const subscriptionFilter: Record<string, unknown> = {}
    if (status) subscriptionFilter.status = status
    if (planId) subscriptionFilter.planId = planId

    const [establishments, total, plans] = await Promise.all([
      prisma.establishment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,
              subscription: {
                include: {
                  plan: {
                    select: { id: true, name: true, price: true, interval: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.establishment.count({ where }),
      prisma.plan.findMany({
        where: { active: true },
        select: { id: true, name: true, price: true, interval: true },
        orderBy: { price: 'asc' },
      }),
    ])

    // Filtra por status/plano da subscription em memoria (pois esta em relacao aninhada)
    let companies = establishments.map((est) => ({
      establishmentId: est.id,
      establishmentName: est.name,
      slug: est.slug,
      userId: est.user.id,
      ownerName: est.user.name,
      ownerEmail: est.user.email,
      ownerPhone: est.user.phone,
      createdAt: est.user.createdAt,
      subscription: est.user.subscription
        ? {
            id: est.user.subscription.id,
            status: est.user.subscription.status,
            startDate: est.user.subscription.startDate,
            endDate: est.user.subscription.endDate,
            trialEndsAt: est.user.subscription.trialEndsAt,
            isTrial: est.user.subscription.isTrial,
            cancelledAt: est.user.subscription.cancelledAt,
            plan: est.user.subscription.plan,
          }
        : null,
    }))

    // Aplica filtros de subscription
    if (status) {
      companies = companies.filter((c) => c.subscription?.status === status)
    }
    if (planId) {
      companies = companies.filter((c) => c.subscription?.plan.id === planId)
    }

    return NextResponse.json({
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      plans,
    })
  } catch (error) {
    console.error('[Admin Companies] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 })
  }
}
