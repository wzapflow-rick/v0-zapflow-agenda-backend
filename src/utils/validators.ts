import { z } from 'zod';

// ==================== AUTH ====================

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional(),
  establishmentName: z.string().min(2, 'Nome do estabelecimento deve ter no mínimo 2 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

// ==================== ESTABLISHMENT ====================

export const updateEstablishmentSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  logo: z.string().url('URL inválida').optional(),
  businessHours: z.record(z.object({
    open: z.string(),
    close: z.string(),
    enabled: z.boolean(),
  })).optional(),
  timezone: z.string().optional(),
  slotDuration: z.number().min(5).max(480).optional(),
});

// ==================== PROFESSIONAL ====================

export const createProfessionalSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  avatar: z.string().url('URL inválida').optional(),
  bio: z.string().optional(),
  workingHours: z.record(z.object({
    open: z.string(),
    close: z.string(),
    enabled: z.boolean(),
  })).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

export const updateProfessionalSchema = createProfessionalSchema.partial().extend({
  active: z.boolean().optional(),
});

// ==================== SERVICE ====================

export const createServiceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  description: z.string().optional(),
  duration: z.number().min(5, 'Duração mínima de 5 minutos').max(480, 'Duração máxima de 8 horas'),
  price: z.number().min(0, 'Preço não pode ser negativo'),
  professionalIds: z.array(z.string().uuid()).optional(),
});

export const updateServiceSchema = createServiceSchema.partial().extend({
  active: z.boolean().optional(),
});

// ==================== CLIENT ====================

export const createClientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().min(10, 'Telefone inválido'),
  notes: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ==================== APPOINTMENT ====================

export const createAppointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:mm'),
  clientId: z.string().uuid('ID do cliente inválido'),
  professionalId: z.string().uuid('ID do profissional inválido'),
  serviceId: z.string().uuid('ID do serviço inválido'),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:mm').optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  notes: z.string().optional(),
});

export const availableSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  serviceId: z.string().uuid('ID do serviço inválido'),
  professionalId: z.string().uuid('ID do profissional inválido').optional(),
});

// ==================== PUBLIC APPOINTMENT ====================

export const createPublicAppointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:mm'),
  professionalId: z.string().uuid('ID do profissional inválido'),
  serviceId: z.string().uuid('ID do serviço inválido'),
  notes: z.string().optional(),
  // Dados do cliente (para agendamento público)
  client: z.object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    email: z.string().email('Email inválido').optional(),
    phone: z.string().min(10, 'Telefone inválido'),
  }),
});

// ==================== SUBSCRIPTION ====================

export const checkoutSchema = z.object({
  planId: z.string().uuid('ID do plano inválido'),
});

// ==================== QUERY PARAMS ====================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const appointmentFiltersSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  professionalId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
});

// ==================== HELPER ====================

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
export type CreatePublicAppointmentInput = z.infer<typeof createPublicAppointmentSchema>;
export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuerySchema>;
export type AppointmentFilters = z.infer<typeof appointmentFiltersSchema>;
