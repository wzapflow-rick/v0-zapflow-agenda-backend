import { NextResponse } from 'next/server'
import { getAdminFromCookies } from '@/lib/admin-auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const admin = await getAdminFromCookies()
    
    if (!admin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Get current date info
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    // Parallel queries for metrics
    const [
      totalUsers,
      totalEstablishments,
      totalBookings,
      totalServices,
      totalProfessionals,
      activeSubscriptions,
      todayBookings,
      weekBookings,
      monthBookings,
      totalMessagesSent,
      messagesByStatus,
      bookingsByStatus,
      recentAuditLogs,
      recentUsers,
      subscriptionsByPlan
    ] = await Promise.all([
      // Total counts
      prisma.user.count(),
      prisma.establishment.count(),
      prisma.booking.count(),
      prisma.service.count(),
      prisma.professional.count(),
      prisma.subscription.count({
        where: { status: 'active' }
      }),
      
      // Time-based bookings
      prisma.booking.count({
        where: { dateTime: { gte: startOfToday } }
      }),
      prisma.booking.count({
        where: { dateTime: { gte: startOfWeek } }
      }),
      prisma.booking.count({
        where: { dateTime: { gte: startOfMonth } }
      }),

      // Messages
      prisma.messageLog.count(),
      prisma.messageLog.groupBy({
        by: ['status'],
        _count: { status: true }
      }),

      // Bookings by status
      prisma.booking.groupBy({
        by: ['status'],
        _count: { status: true }
      }),

      // Recent audit logs
      prisma.auditLog.count(),

      // Users created in last 30 days
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Subscriptions by plan
      prisma.subscription.groupBy({
        by: ['planId'],
        where: { status: 'active' },
        _count: { planId: true }
      })
    ])

    // Get plan names for subscription breakdown
    const planIds = subscriptionsByPlan.map(s => s.planId)
    const plans = await prisma.plan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, name: true }
    })

    const planMap = new Map(plans.map(p => [p.id, p.name]))
    const subscriptionsWithPlanNames = subscriptionsByPlan.map(s => ({
      planId: s.planId,
      planName: planMap.get(s.planId) || 'Desconhecido',
      count: s._count.planId
    }))

    // Calculate growth rates (mock for now - would need historical data)
    const metrics = {
      overview: {
        totalUsers,
        totalEstablishments,
        totalBookings,
        totalServices,
        totalProfessionals,
        activeSubscriptions,
        newUsersLast30Days: recentUsers
      },
      bookings: {
        today: todayBookings,
        thisWeek: weekBookings,
        thisMonth: monthBookings,
        byStatus: bookingsByStatus.map(b => ({
          status: b.status,
          count: b._count.status
        }))
      },
      messages: {
        total: totalMessagesSent,
        byStatus: messagesByStatus.map(m => ({
          status: m.status,
          count: m._count.status
        }))
      },
      subscriptions: {
        active: activeSubscriptions,
        byPlan: subscriptionsWithPlanNames
      },
      audit: {
        totalLogs: recentAuditLogs
      },
      timestamp: now.toISOString()
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Admin metrics error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    )
  }
}
