import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

// Resposta de sucesso
export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

// Resposta de erro
export function error(message: string, status = 400, details?: unknown): NextResponse<ApiResponse> {
  return NextResponse.json(
    { success: false, error: message, ...(details && { details }) },
    { status }
  );
}

// Handler de erros
export function handleError(err: unknown): NextResponse<ApiResponse> {
  console.error('[API Error]', err);

  if (err instanceof ZodError) {
    return error('Dados inválidos', 400, err.errors);
  }

  if (err instanceof ApiError) {
    return error(err.message, err.statusCode);
  }

  if (err instanceof Error) {
    // Erro do Prisma - registro não encontrado
    if (err.message.includes('Record to update not found') || 
        err.message.includes('Record to delete not found')) {
      return error('Registro não encontrado', 404);
    }
    
    // Erro do Prisma - violação de unique
    if (err.message.includes('Unique constraint failed')) {
      return error('Registro já existe', 409);
    }

    return error(err.message, 500);
  }

  return error('Erro interno do servidor', 500);
}

// Classe de erro customizada
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(`${resource} não encontrado(a)`, 404);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Não autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Acesso negado') {
    super(message, 403);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409);
  }
}

import { prisma } from './prisma';

// Função para criar log de auditoria
export async function auditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        resourceType: params.entityType,
        resourceId: params.entityId,
        userId: params.userId || null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (error) {
    console.error('[auditLog] Erro ao criar log de auditoria:', error);
    // Não propagar erro para não quebrar a operação principal
  }
}
