// Classe base para erros da aplicação
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Erro de não encontrado (404)
export class NotFoundError extends AppError {
  constructor(resource: string = 'Recurso') {
    super(`${resource} não encontrado`, 404);
  }
}

// Erro de autenticação (401)
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(message, 401);
  }
}

// Erro de permissão (403)
export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message, 403);
  }
}

// Erro de validação (400)
export class ValidationError extends AppError {
  public readonly errors: { field: string; message: string }[];

  constructor(errors: { field: string; message: string }[]) {
    super('Erro de validação', 400);
    this.errors = errors;
  }
}

// Erro de conflito (409)
export class ConflictError extends AppError {
  constructor(message: string = 'Conflito de dados') {
    super(message, 409);
  }
}

// Erro de limite excedido (429)
export class RateLimitError extends AppError {
  constructor(message: string = 'Muitas requisições. Tente novamente mais tarde.') {
    super(message, 429);
  }
}

// Erro de plano/assinatura
export class SubscriptionError extends AppError {
  constructor(message: string = 'Erro de assinatura') {
    super(message, 402);
  }
}
