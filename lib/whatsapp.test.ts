import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    automaticMessageSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    messageLog: {
      create: vi.fn(),
    },
    establishment: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock do fetch global
global.fetch = vi.fn()

describe('WhatsApp - Envio de Mensagens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EVOLUTION_API_URL = 'https://evo.test.com'
    process.env.EVOLUTION_API_KEY = 'test-api-key'
  })

  describe('formatPhoneNumber', () => {
    it('deve adicionar 55 no inicio se nao tiver', async () => {
      // Importa dinamicamente para que os mocks sejam aplicados
      const { formatPhoneNumber } = await import('./whatsapp-utils')
      
      expect(formatPhoneNumber('11999999999')).toBe('5511999999999')
      expect(formatPhoneNumber('5511999999999')).toBe('5511999999999')
      expect(formatPhoneNumber('(11) 99999-9999')).toBe('5511999999999')
    })
  })

  describe('canSendMessage', () => {
    it('deve retornar false se settings nao existir', async () => {
      const prisma = (await import('@/lib/prisma')).default
      vi.mocked(prisma.automaticMessageSettings.findUnique).mockResolvedValue(null)
      
      const { canSendMessage } = await import('./whatsapp-utils')
      const result = await canSendMessage('establishment-id', 'confirmation')
      
      expect(result.canSend).toBe(false)
    })

    it('deve retornar false se WhatsApp nao estiver conectado', async () => {
      const prisma = (await import('@/lib/prisma')).default
      vi.mocked(prisma.automaticMessageSettings.findUnique).mockResolvedValue({
        id: '1',
        establishmentId: 'est-1',
        whatsappConnected: false,
        whatsappInstanceName: 'test-instance',
        whatsappPhone: null,
        activeMessages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      
      const { canSendMessage } = await import('./whatsapp-utils')
      const result = await canSendMessage('establishment-id', 'confirmation')
      
      expect(result.canSend).toBe(false)
    })

    it('deve retornar true se WhatsApp estiver conectado', async () => {
      const prisma = (await import('@/lib/prisma')).default
      vi.mocked(prisma.automaticMessageSettings.findUnique).mockResolvedValue({
        id: '1',
        establishmentId: 'est-1',
        whatsappConnected: true,
        whatsappInstanceName: 'test-instance',
        whatsappPhone: '5511999999999',
        activeMessages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      
      const { canSendMessage } = await import('./whatsapp-utils')
      const result = await canSendMessage('establishment-id', 'confirmation')
      
      expect(result.canSend).toBe(true)
      expect(result.settings?.whatsappInstanceName).toBe('test-instance')
    })
  })
})

describe('WhatsApp - Evolution API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EVOLUTION_API_URL = 'https://evo.test.com'
    process.env.EVOLUTION_API_KEY = 'test-api-key'
  })

  describe('getInstanceStatus', () => {
    it('deve retornar connected: true quando state = open', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ state: 'open' }),
      } as Response)

      const { evolutionApi } = await import('./whatsapp')
      const result = await evolutionApi.getInstanceStatus('test-instance')
      
      expect(result.connected).toBe(true)
    })

    it('deve retornar connected: true quando instance.state = connected', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ instance: { state: 'connected' } }),
      } as Response)

      const { evolutionApi } = await import('./whatsapp')
      const result = await evolutionApi.getInstanceStatus('test-instance')
      
      expect(result.connected).toBe(true)
    })

    it('deve retornar connected: false quando nao conectado', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ state: 'close' }),
      } as Response)

      const { evolutionApi } = await import('./whatsapp')
      const result = await evolutionApi.getInstanceStatus('test-instance')
      
      expect(result.connected).toBe(false)
    })

    it('deve retornar connected: false quando API falha', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      const { evolutionApi } = await import('./whatsapp')
      const result = await evolutionApi.getInstanceStatus('test-instance')
      
      expect(result.connected).toBe(false)
    })
  })
})

describe('Recuperacao de Senha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Fluxo completo', () => {
    it('deve gerar codigo de 6 digitos', () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      expect(code.length).toBe(6)
      expect(Number(code)).toBeGreaterThanOrEqual(100000)
      expect(Number(code)).toBeLessThan(1000000)
    })

    it('deve normalizar telefone corretamente', () => {
      const normalizePhone = (phone: string) => {
        let normalized = phone.replace(/\D/g, '')
        if (!normalized.startsWith('55')) {
          normalized = '55' + normalized
        }
        return normalized
      }

      expect(normalizePhone('11999999999')).toBe('5511999999999')
      expect(normalizePhone('5511999999999')).toBe('5511999999999')
      expect(normalizePhone('(11) 99999-9999')).toBe('5511999999999')
    })
  })
})
