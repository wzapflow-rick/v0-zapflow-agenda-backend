import { z } from 'zod';
import { BusinessType } from '@prisma/client';

// Enum de nicho de negócio (validado no backend, nunca confiar no frontend)
export const businessTypeEnum = z.nativeEnum(BusinessType);

// Validacao de senha forte (OWASP)
const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres')
  .max(128, 'Senha muito longa')
  .refine((val) => /[a-z]/.test(val), 'Senha deve conter letra minuscula')
  .refine((val) => /[A-Z]/.test(val), 'Senha deve conter letra maiuscula')
  .refine((val) => /[0-9]/.test(val), 'Senha deve conter numero');

// Validacao de senha mais simples para login (apenas min length)
const loginPasswordSchema = z.string().min(1, 'Senha e obrigatoria');

// Auth
export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email invalido').max(254),
  password: passwordSchema,
  establishmentName: z.string().min(2, 'Nome do estabelecimento deve ter pelo menos 2 caracteres').max(100),
  phone: z.string().optional(),
  businessType: businessTypeEnum.optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email invalido').max(254),
  password: loginPasswordSchema,
});

// Working Hours Schema - aceita ambos os formatos (sem transform para permitir partial)
const workingHoursDaySchema = z.object({
  isOpen: z.boolean().optional(),
  enabled: z.boolean().optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  open: z.string().optional(),
  close: z.string().optional(),
});

const workingHoursSchema = z.record(workingHoursDaySchema).optional();

// Helper para normalizar working hours
export function normalizeWorkingHours(data: Record<string, any> | undefined) {
  if (!data) return undefined;
  const result: Record<string, { isOpen: boolean; openTime: string; closeTime: string }> = {};
  for (const [day, hours] of Object.entries(data)) {
    if (hours && typeof hours === 'object') {
      result[day] = {
        isOpen: hours.isOpen ?? hours.enabled ?? false,
        openTime: hours.openTime ?? hours.start ?? hours.open ?? '09:00',
        closeTime: hours.closeTime ?? hours.end ?? hours.close ?? '18:00',
      };
    }
  }
  return result;
}

// Establishment
export const updateEstablishmentSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  timezone: z.string().optional(),
  slotDuration: z.number().int().min(5).max(120).optional(),
  workingHours: workingHoursSchema,
  businessHours: workingHoursSchema,
  businessType: businessTypeEnum.optional(),
  metadata: z.record(z.any()).optional().nullable(),
});

// Professional
export const createProfessionalSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  avatar: z.string().url().optional(),
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  workingHours: workingHoursSchema,
});

export const updateProfessionalSchema = createProfessionalSchema.partial().extend({
  isActive: z.boolean().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

// Service
export const createServiceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  duration: z.number().int().min(5, 'Duração mínima é 5 minutos'),
  price: z.number().min(0, 'Preço não pode ser negativo'),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Client
export const createClientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().min(10, 'Telefone inválido'),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

// Appointment
export const createAppointmentSchema = z.object({
  professionalId: z.string().uuid('ID do profissional inválido'),
  serviceId: z.string().uuid('ID do serviço inválido'),
  clientId: z.string().uuid('ID do cliente inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:MM'),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
  notes: z.string().optional(),
});

// Public Booking
export const publicBookingSchema = z.object({
  professionalId: z.string().uuid('ID do profissional inválido'),
  serviceId: z.string().uuid('ID do serviço inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:MM'),
  clientName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  clientPhone: z.string().min(10, 'Telefone inválido'),
  clientEmail: z.string().email('Email inválido').optional(),
  notes: z.string().optional(),
});

// Subscription
export const createSubscriptionSchema = z.object({
  planId: z.string().uuid('ID do plano inválido'),
});

// Confirmation Settings (fluxo de confirmacao via WhatsApp)
const confirmationTemplatesSchema = z.object({
  reservation_created: z.string().default(''),
  confirmation_request: z.string().default(''),
  confirmation_reminder: z.string().default(''),
  confirmation_cancelled: z.string().default(''),
  final_reminder: z.string().default(''),
});

export const updateConfirmationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  leadTimeHours: z.number().int().min(1, 'Lead time mínimo é 1 hora').max(168, 'Lead time máximo é 168 horas').optional(),
  templates: confirmationTemplatesSchema.partial().optional(),
});

// Confirmation Service Report (relatorio do cron)
export const confirmationReportSchema = z.object({
  results: z.array(
    z.object({
      appointmentId: z.string().uuid('ID do agendamento inválido'),
      action: z.enum([
        'send_reservation',
        'send_confirmation_request',
        'send_confirmation_reminder',
        'cancel_no_confirmation',
        'send_final_reminder',
      ]),
      success: z.boolean(),
      error: z.string().optional(),
    })
  ),
});

// Types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateEstablishmentInput = z.infer<typeof updateEstablishmentSchema>;
export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;
export type UpdateProfessionalInput = z.infer<typeof updateProfessionalSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
