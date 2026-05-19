import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromCookies } from '@/lib/admin-auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookies()
    
    if (!admin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') || undefined
    const channel = searchParams.get('channel') || undefined

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (channel) where.channel = channel

    const [logs, total] = await Promise.all([
      prisma.messageLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          booking: {
            select: {
              id: true,
              clientName: true,
              clientPhone: true
            }
          },
          establishment: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.messageLog.count({ where })
    ])

    // Get unique statuses and channels for filters
    const [statuses, channels] = await Promise.all([
      prisma.messageLog.findMany({
        select: { status: true },
        distinct: ['status']
      }),
      prisma.messageLog.findMany({
        select: { channel: true },
        distinct: ['channel']
      })
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        statuses: statuses.map(s => s.status),
        channels: channels.map(c => c.channel)
      }
    })
  } catch (error) {
    console.error('Admin message logs error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar logs de mensagens' },
      { status: 500 }
    )
  }
}
