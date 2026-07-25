import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminFromCookies } from '@/lib/admin-auth'
import { sanitizePhone } from '@/lib/sanitize'
import { sendSystemWhatsAppMessage } from '@/lib/system-whatsapp'

const testSchema = z.object({
  phone: z.string().min(10, 'Telefone inválido'),
  message: z.string().max(1000).optional(),
})

/**
 * POST /api/admin/settings/whatsapp/test
 * Envia uma mensagem de teste pela instancia de mensagens gerais, para o admin
 * confirmar que ela realmente esta funcionando.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = testSchema.parse(body)

    let phone = sanitizePhone(data.phone)
    if (!phone.startsWith('55')) {
      phone = `55${phone}`
    }

    const message =
      data.message ||
      '*ZapFlow Agenda*\n\nMensagem de teste da instância de mensagens gerais. Se você recebeu isto, o envio está funcionando.'

    const result = await sendSystemWhatsAppMessage(phone, message)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          instanceName: result.instanceName,
          error: result.error || 'Falha ao enviar mensagem de teste',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      instanceName: result.instanceName,
      message: 'Mensagem de teste enviada',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[Admin WhatsApp Test Error]', error)
    return NextResponse.json({ error: 'Erro ao enviar mensagem de teste' }, { status: 500 })
  }
}
