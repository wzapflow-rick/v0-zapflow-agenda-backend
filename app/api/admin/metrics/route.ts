import { NextResponse } from 'next/server'
import { getAdminFromCookies } from '@/lib/admin-auth'
import prisma from '@/lib/prisma'
import { getMetricsSummary, getCacheHitRatio, getAverageQueryTime } from '@/lib/metrics'

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

    // Busca metricas do Redis (cache, rate limit, performance)
    let redisMetrics = null
    try {
      const [summary, cacheHitRatio, avgQueryTime] = await Promise.all([
        getMetricsSummary(24),
        getCacheHitRatio(24),
        getAverageQueryTime(24),
      ])

      const whatsappSuccessRate = 
        summary.whatsapp_sent?.count 
          ? (summary.whatsapp_sent.count / (summary.whatsapp_sent.count + (summary.whatsapp_failed?.count || 0))) * 100
          : 100

      redisMetrics = {
        cache: {
          hits: summary.slots_cache_hit?.count || 0,
          misses: summary.slots_cache_miss?.count || 0,
          stale: summary.slots_cache_stale?.count || 0,
          hitRatio: Math.round(cacheHitRatio * 100) / 100,
        },
        performance: {
          avgQueryTimeMs: Math.round(avgQueryTime),
          minQueryTimeMs: summary.slots_query_duration?.min || 0,
          maxQueryTimeMs: summary.slots_query_duration?.max || 0,
          totalQueries: summary.slots_query_duration?.count || 0,
        },
        whatsapp: {
          sent: summary.whatsapp_sent?.count || 0,
          failed: summary.whatsapp_failed?.count || 0,
          successRate: Math.round(whatsappSuccessRate * 100) / 100,
        },
        rateLimit: {
          exceeded: summary.rate_limit_exceeded?.count || 0,
        },
        errors: {
          booking: summary.error_booking?.count || 0,
          whatsapp: summary.error_whatsapp?.count || 0,
          webhook: summary.error_webhook?.count || 0,
          auth: summary.error_auth?.count || 0,
        },
      }
    } catch (redisError) {
      console.error('[Metrics] Redis metrics unavailable:', redisError)
    }

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
      redis: redisMetrics,
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
