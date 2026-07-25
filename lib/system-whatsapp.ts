import prisma from './prisma'
import { evolutionApi } from './whatsapp'

/**
 * Instancia "de sistema" (mensagens gerais).
 *
 * Esta instancia NAO pertence a nenhum estabelecimento: ela e usada para as
 * mensagens transacionais da plataforma (recuperacao de senha, avisos de
 * trial, comunicados etc).
 *
 * Antes o nome estava fixo no codigo ('SimpleCRM'), o que fazia todos os
 * envios falharem silenciosamente quando aquela instancia era renomeada ou
 * desconectada. Agora o nome fica em AppSettings e pode ser alterado pelo
 * painel admin.
 */

export const SYSTEM_WHATSAPP_INSTANCE_KEY = 'system_whatsapp_instance'
export const SYSTEM_WHATSAPP_ENABLED_KEY = 'system_whatsapp_enabled'

// Fallback: variavel de ambiente e, por ultimo, o nome legado.
const FALLBACK_INSTANCE = process.env.EVOLUTION_SYSTEM_INSTANCE || 'SimpleCRM'

/** Nome da instancia usada para as mensagens gerais da plataforma. */
export async function getSystemInstanceName(): Promise<string> {
  try {
    const setting = await prisma.appSettings.findUnique({
      where: { key: SYSTEM_WHATSAPP_INSTANCE_KEY },
    })

    const value = setting?.value?.trim()
    return value && value.length > 0 ? value : FALLBACK_INSTANCE
  } catch (error) {
    console.error('[System WhatsApp] Erro ao buscar instancia configurada:', error)
    return FALLBACK_INSTANCE
  }
}

/** Indica se o envio de mensagens gerais esta habilitado (default: true). */
export async function isSystemWhatsAppEnabled(): Promise<boolean> {
  try {
    const setting = await prisma.appSettings.findUnique({
      where: { key: SYSTEM_WHATSAPP_ENABLED_KEY },
    })

    // Ausencia da chave significa habilitado, para nao quebrar instalacoes antigas.
    if (!setting || setting.value === null) return true
    return setting.value !== 'false'
  } catch (error) {
    console.error('[System WhatsApp] Erro ao verificar se esta habilitado:', error)
    return true
  }
}

/** Grava o nome da instancia de sistema. */
export async function setSystemInstanceName(instanceName: string): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key: SYSTEM_WHATSAPP_INSTANCE_KEY },
    update: { value: instanceName, updatedAt: new Date() },
    create: {
      key: SYSTEM_WHATSAPP_INSTANCE_KEY,
      value: instanceName,
      description: 'Instancia da Evolution API usada para mensagens gerais da plataforma',
    },
  })
}

/** Habilita ou desabilita o envio de mensagens gerais. */
export async function setSystemWhatsAppEnabled(enabled: boolean): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key: SYSTEM_WHATSAPP_ENABLED_KEY },
    update: { value: String(enabled), updatedAt: new Date() },
    create: {
      key: SYSTEM_WHATSAPP_ENABLED_KEY,
      value: String(enabled),
      description: 'Habilita o envio de mensagens gerais da plataforma via WhatsApp',
    },
  })
}

/** Status atual da instancia de sistema na Evolution API. */
export async function getSystemInstanceStatus(): Promise<{
  instanceName: string
  connected: boolean
  enabled: boolean
  configured: boolean
}> {
  const [instanceName, enabled] = await Promise.all([
    getSystemInstanceName(),
    isSystemWhatsAppEnabled(),
  ])

  const { connected } = await evolutionApi.getInstanceStatus(instanceName)

  return {
    instanceName,
    connected,
    enabled,
    configured: Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY),
  }
}

/**
 * Envia uma mensagem geral da plataforma pela instancia de sistema.
 * Usar sempre esta funcao em vez de escrever o nome da instancia no codigo.
 */
export async function sendSystemWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string; instanceName: string }> {
  const instanceName = await getSystemInstanceName()

  const enabled = await isSystemWhatsAppEnabled()
  if (!enabled) {
    console.warn('[System WhatsApp] Envio de mensagens gerais desabilitado no painel admin')
    return { success: false, error: 'Envio de mensagens gerais desabilitado', instanceName }
  }

  const result = await evolutionApi.sendText(instanceName, phone, message)

  if (!result.success) {
    console.error(
      `[System WhatsApp] Falha ao enviar pela instancia "${instanceName}":`,
      result.error
    )
  }

  return { ...result, instanceName }
}
