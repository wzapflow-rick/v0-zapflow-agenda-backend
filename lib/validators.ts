import { z } from 'zod';

// Auth
export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  establishmentName: z.string().min(2, 'Nome do estabelecimento deve ter pelo menos 2 caracteres'),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

// Working Hours Schema - aceita ambos os formatos
const workingHoursDaySchema = z.object({
  isOpen: z.boolean().optional(),
  enabled: z.boolean().optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  open: z.string().optional(),
  close: z.string().optional(),
}).transform((data) => ({
  isOpen: data.isOpen ?? data.enabled ?? false,
  openTime: data.openTime ?? data.start ?? data.open ?? '09:00',
  closeTime: data.closeTime ?? data.end ?? data.close ?? '18:00',
}));

const workingHoursSchema = z.record(workingHoursDaySchema).optional();

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
}).transform((data) => ({
  ...data,
  workingHours: data.workingHours ?? data.businessHours,
}));

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
}).transform((data) => ({
  ...data,
  avatarUrl: data.avatarUrl ?? data.avatar,
}));

export const updateProfessionalSchema = createProfessionalSchema.partial().extend({
  isActive: z.boolean().optional(),
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
