import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminFromCookies } from '@/lib/admin-auth'
import { evolutionApi } from '@/lib/whatsapp'
import { getSystemInstanceName, getSystemInstanceStatus } from '@/lib/system-whatsapp'

const actionSchema = z.object({
  action: z.enum(['connect', 'disconnect', 'restart']),
})

/**
 * GET /api/admin/settings/whatsapp/connection
 * Apenas o status da instancia de mensagens gerais (leve, ideal para polling
 * enquanto o admin le o QR Code).
 */
export async function GET() {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const status = await getSystemInstanceStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('[Admin WhatsApp Connection GET Error]', error)
    return NextResponse.json({ error: 'Erro ao verificar conexão' }, { status: 500 })
  }
}

/**
 * POST /api/admin/settings/whatsapp/connection
 * Body: { action: "connect" | "disconnect" | "restart" }
 *
 * - connect: cria a instancia se ela ainda nao existir e devolve o QR Code
 * - disconnect: faz logout do WhatsApp sem apagar a instancia
 * - restart: reinicia a instancia (uso quando ela travou em "connecting")
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = actionSchema.parse(body)

    const instanceName = await getSystemInstanceName()

    if (action === 'disconnect') {
      const result = await evolutionApi.logoutInstance(instanceName)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Não foi possível desconectar', instanceName },
          { status: 502 }
        )
      }
      return NextResponse.json({
        success: true,
        instanceName,
        message: 'Instância desconectada',
      })
    }

    if (action === 'restart') {
      const result = await evolutionApi.restartInstance(instanceName)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Não foi possível reiniciar', instanceName },
          { status: 502 }
        )
      }
      return NextResponse.json({
        success: true,
        instanceName,
        message: 'Instância reiniciada',
      })
    }

    // action === 'connect'
    // Se a instancia ja existe e esta conectada, nao ha QR para gerar.
    const current = await evolutionApi.getInstanceStatus(instanceName)
    if (current.connected) {
      return NextResponse.json({
        success: true,
        instanceName,
        connected: true,
        message: 'Instância já está conectada',
      })
    }

    // Garante que a instancia exista antes de pedir o QR Code.
    const instancesResult = await evolutionApi.fetchInstances()
    const exists = instancesResult.instances.some((i) => i.name === instanceName)

    if (!exists) {
      const created = await evolutionApi.createInstance(instanceName)
      if (!created.success) {
        return NextResponse.json(
          { error: 'Não foi possível criar a instância na Evolution API', instanceName },
          { status: 502 }
        )
      }
      if (created.qrCode) {
        return NextResponse.json({
          success: true,
          instanceName,
          connected: false,
          created: true,
          qrCode: created.qrCode,
        })
      }
    }

    const connection = await evolutionApi.connectInstance(instanceName)
    if (!connection.success) {
      return NextResponse.json(
        { error: connection.error || 'Não foi possível gerar o QR Code', instanceName },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      instanceName,
      connected: false,
      created: !exists,
      qrCode: connection.qrCode,
      pairingCode: connection.pairingCode,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ação inválida. Use connect, disconnect ou restart', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[Admin WhatsApp Connection POST Error]', error)
    return NextResponse.json({ error: 'Erro ao executar ação de conexão' }, { status: 500 })
  }
}
