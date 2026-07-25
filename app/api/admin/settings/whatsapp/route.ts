import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminFromCookies } from '@/lib/admin-auth'
import { evolutionApi } from '@/lib/whatsapp'
import {
  getSystemInstanceStatus,
  setSystemInstanceName,
  setSystemWhatsAppEnabled,
} from '@/lib/system-whatsapp'

const updateSchema = z.object({
  // Nome da instancia na Evolution API (ex: "ZapFlow-Sistema")
  instanceName: z
    .string()
    .trim()
    .min(3, 'Nome da instancia deve ter ao menos 3 caracteres')
    .max(60, 'Nome da instancia muito longo')
    .regex(
      /^[A-Za-z0-9._-]+$/,
      'Use apenas letras, numeros, ponto, hifen ou underscore (sem espacos)'
    )
    .optional(),
  enabled: z.boolean().optional(),
})

/**
 * GET /api/admin/settings/whatsapp
 * Retorna a instancia de mensagens gerais, se ela esta conectada e a lista de
 * instancias disponiveis na Evolution API (para escolher no painel).
 */
export async function GET() {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const [status, instancesResult] = await Promise.all([
      getSystemInstanceStatus(),
      evolutionApi.fetchInstances(),
    ])

    return NextResponse.json({
      system: status,
      availableInstances: instancesResult.instances,
      instancesError: instancesResult.error ?? null,
    })
  } catch (error) {
    console.error('[Admin WhatsApp Settings GET Error]', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configuração do WhatsApp' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/settings/whatsapp
 * Altera o nome da instancia usada nas mensagens gerais e/ou liga/desliga o envio.
 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = updateSchema.parse(body)

    if (data.instanceName === undefined && data.enabled === undefined) {
      return NextResponse.json(
        { error: 'Informe instanceName e/ou enabled' },
        { status: 400 }
      )
    }

    if (data.instanceName !== undefined) {
      await setSystemInstanceName(data.instanceName)
    }

    if (data.enabled !== undefined) {
      await setSystemWhatsAppEnabled(data.enabled)
    }

    const status = await getSystemInstanceStatus()

    return NextResponse.json({
      success: true,
      message: 'Configuração de mensagens gerais atualizada',
      system: status,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[Admin WhatsApp Settings PATCH Error]', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar configuração do WhatsApp' },
      { status: 500 }
    )
  }
}
