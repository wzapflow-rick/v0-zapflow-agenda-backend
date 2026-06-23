import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromCookies } from '@/lib/admin-auth'
import prisma from '@/lib/prisma'

// GET /api/admin/companies/[id] - Detalhes de uma empresa (id = establishmentId)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { id } = await params

    const establishment = await prisma.establishment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            subscription: {
              include: { plan: true },
            },
          },
        },
      },
    })

    if (!establishment) {
      return NextResponse.json({ error: 'Empresa nao encontrada' }, { status: 404 })
    }

    return NextResponse.json({ establishment })
  } catch (error) {
    console.error('[Admin Company GET] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
  }
}

type UpdateAction =
  | 'change_plan'
  | 'grant_trial'
  | 'set_end_date'
  | 'set_status'
  | 'extend'

// PATCH /api/admin/companies/[id] - Atualiza assinatura (id = establishmentId)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const action = body.action as UpdateAction

    // Busca o estabelecimento e o usuario dono
    const establishment = await prisma.establishment.findUnique({
      where: { id },
      include: {
        user: { include: { subscription: true } },
      },
    })

    if (!establishment) {
      return NextResponse.json({ error: 'Empresa nao encontrada' }, { status: 404 })
    }

    const userId = establishment.user.id
    const existingSub = establishment.user.subscription

    let updateData: Record<string, unknown> = {}
    let auditAction = ''
    let auditDetails = ''

    switch (action) {
      case 'change_plan': {
        const { planId } = body
        if (!planId) {
          return NextResponse.json({ error: 'planId obrigatorio' }, { status: 400 })
        }
        const plan = await prisma.plan.findUnique({ where: { id: planId } })
        if (!plan) {
          return NextResponse.json({ error: 'Plano nao encontrado' }, { status: 404 })
        }
        updateData = { planId }
        auditAction = 'CHANGE_PLAN'
        auditDetails = `Plano alterado para ${plan.name}`
        break
      }

      case 'grant_trial': {
        const { days } = body
        const trialDays = parseInt(days)
        if (!trialDays || trialDays < 1) {
          return NextResponse.json({ error: 'Dias de trial invalidos' }, { status: 400 })
        }
        const trialEndsAt = new Date()
        trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)
        updateData = {
          status: 'TRIALING',
          isTrial: true,
          trialEndsAt,
          startDate: new Date(),
          endDate: trialEndsAt,
          cancelledAt: null,
          trialNotified3Days: false,
          trialNotified1Day: false,
        }
        auditAction = 'GRANT_TRIAL'
        auditDetails = `Trial de ${trialDays} dias concedido (ate ${trialEndsAt.toLocaleDateString('pt-BR')})`
        break
      }

      case 'set_end_date': {
        const { endDate } = body
        if (!endDate) {
          return NextResponse.json({ error: 'Data obrigatoria' }, { status: 400 })
        }
        const parsed = new Date(endDate)
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: 'Data invalida' }, { status: 400 })
        }
        updateData = { endDate: parsed }
        // Se for trial, atualiza tambem o trialEndsAt
        if (existingSub?.isTrial) {
          updateData.trialEndsAt = parsed
        }
        auditAction = 'SET_END_DATE'
        auditDetails = `Vencimento definido para ${parsed.toLocaleDateString('pt-BR')}`
        break
      }

      case 'set_status': {
        const { status } = body
        const validStatuses = ['ACTIVE', 'INACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING', 'TRIAL_EXPIRED']
        if (!validStatuses.includes(status)) {
          return NextResponse.json({ error: 'Status invalido' }, { status: 400 })
        }
        updateData = { status }
        if (status === 'CANCELLED') {
          updateData.cancelledAt = new Date()
        }
        if (status === 'ACTIVE') {
          updateData.isTrial = false
          updateData.cancelledAt = null
        }
        auditAction = 'SET_STATUS'
        auditDetails = `Status alterado para ${status}`
        break
      }

      case 'extend': {
        const { days } = body
        const extendDays = parseInt(days)
        if (!extendDays || extendDays < 1) {
          return NextResponse.json({ error: 'Dias invalidos' }, { status: 400 })
        }
        // Estende a partir do endDate atual (ou hoje se ja venceu)
        const base = existingSub?.endDate && existingSub.endDate > new Date()
          ? new Date(existingSub.endDate)
          : new Date()
        base.setDate(base.getDate() + extendDays)
        updateData = { endDate: base }
        if (existingSub?.isTrial) {
          updateData.trialEndsAt = base
        }
        auditAction = 'EXTEND'
        auditDetails = `Assinatura estendida em ${extendDays} dias (novo vencimento ${base.toLocaleDateString('pt-BR')})`
        break
      }

      default:
        return NextResponse.json({ error: 'Acao invalida' }, { status: 400 })
    }

    // Cria ou atualiza a subscription
    let subscription
    if (existingSub) {
      subscription = await prisma.subscription.update({
        where: { userId },
        data: updateData,
        include: { plan: true },
      })
    } else {
      // Se nao existe subscription, precisa de um planId
      const planId = (updateData.planId as string) || body.planId
      if (!planId) {
        return NextResponse.json(
          { error: 'Empresa sem assinatura. Informe um planId para criar.' },
          { status: 400 }
        )
      }
      subscription = await prisma.subscription.create({
        data: {
          userId,
          planId,
          ...updateData,
        } as never,
        include: { plan: true },
      })
    }

    // Registra auditoria
    await prisma.auditLog.create({
      data: {
        action: auditAction,
        severity: 'MEDIUM',
        userId,
        establishmentId: establishment.id,
        resourceType: 'subscription',
        resourceId: subscription.id,
        details: `[Admin: ${admin.email}] ${auditDetails} - Empresa: ${establishment.name}`,
      },
    }).catch((err) => console.error('[Audit] Erro ao registrar:', err))

    return NextResponse.json({
      success: true,
      message: auditDetails,
      subscription,
    })
  } catch (error) {
    console.error('[Admin Company PATCH] Erro:', error)
    return NextResponse.json({ error: 'Erro ao atualizar empresa' }, { status: 500 })
  }
}

// DELETE /api/admin/companies/[id] - Exclui a empresa e todos os dados (id = establishmentId)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Busca o estabelecimento e o usuario dono
    const establishment = await prisma.establishment.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    })

    if (!establishment) {
      return NextResponse.json({ error: 'Empresa nao encontrada' }, { status: 404 })
    }

    // Confirmacao por nome para evitar exclusao acidental
    const body = await request.json().catch(() => ({}))
    if (body?.confirmName !== establishment.name) {
      return NextResponse.json(
        { error: 'Confirmacao invalida. Digite o nome exato da empresa.' },
        { status: 400 }
      )
    }

    const userId = establishment.user.id
    const ownerEmail = establishment.user.email
    const establishmentName = establishment.name

    // Exclui o usuario dono. O onDelete: Cascade remove o estabelecimento e
    // todos os dados relacionados (agendamentos, clientes, servicos,
    // profissionais, assinatura, notificacoes, etc).
    await prisma.user.delete({ where: { id: userId } })

    // Registra auditoria (AuditLog nao tem FK, entao sobrevive a exclusao)
    await prisma.auditLog.create({
      data: {
        action: 'DELETE_COMPANY',
        severity: 'HIGH',
        userId,
        establishmentId: id,
        resourceType: 'establishment',
        resourceId: id,
        details: `[Admin: ${admin.email}] Empresa excluida permanentemente: ${establishmentName} (${ownerEmail})`,
      },
    }).catch((err) => console.error('[Audit] Erro ao registrar:', err))

    return NextResponse.json({
      success: true,
      message: `Empresa "${establishmentName}" excluida com sucesso`,
    })
  } catch (error) {
    console.error('[Admin Company DELETE] Erro:', error)
    return NextResponse.json({ error: 'Erro ao excluir empresa' }, { status: 500 })
  }
}
