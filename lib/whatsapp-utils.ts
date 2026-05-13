import prisma from './prisma'

// Formata o numero de telefone para o formato da Evolution API (5511999999999)
export function formatPhoneNumber(phone: string): string {
  const numbers = phone.replace(/\D/g, '')
  if (numbers.startsWith('55')) {
    return numbers
  }
  return `55${numbers}`
}

// Verifica se o WhatsApp esta conectado
export async function canSendMessage(
  establishmentId: string,
  messageType: string
): Promise<{ canSend: boolean; settings?: { whatsappInstanceName: string } }> {
  try {
    const settings = await prisma.automaticMessageSettings.findUnique({
      where: { establishmentId },
    })

    if (!settings) {
      return { canSend: false }
    }

    if (!settings.whatsappConnected || !settings.whatsappInstanceName) {
      return { canSend: false }
    }

    return { canSend: true, settings: { whatsappInstanceName: settings.whatsappInstanceName } }
  } catch (error) {
    return { canSend: false }
  }
}
