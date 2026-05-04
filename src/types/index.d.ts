import { User, Establishment } from '@prisma/client';

// Extensão do Request do Express para incluir usuário autenticado
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      establishment?: Establishment;
    }
  }
}

// Usuário autenticado (sem a senha)
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  establishmentId?: string;
}

// Payload do JWT
export interface JwtPayload {
  userId: string;
  email: string;
}

// Response padrão da API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
}

// Erro de validação
export interface ValidationError {
  field: string;
  message: string;
}

// Parâmetros de paginação
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Response paginada
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Slot de horário disponível
export interface AvailableSlot {
  startTime: string;
  endTime: string;
  professionalId: string;
  professionalName: string;
}

// Horário de funcionamento
export interface BusinessHours {
  [day: string]: {
    open: string;
    close: string;
    enabled: boolean;
  };
}

export {};
