// Audit Logging (OWASP A09 - Security Logging and Monitoring Failures)
// Registra acoes criticas para auditoria

import prisma from './prisma';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS'
  | 'PASSWORD_CHANGE'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_CANCELLED'
  | 'PROFESSIONAL_CREATED'
  | 'PROFESSIONAL_DELETED'
  | 'SERVICE_CREATED'
  | 'SERVICE_DELETED'
  | 'SETTINGS_CHANGED'
  | 'WHATSAPP_CONNECTED'
  | 'WHATSAPP_DISCONNECTED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED_ACCESS'
  | 'SUSPICIOUS_ACTIVITY';

export interface AuditLogData {
  action: AuditAction;
  userId?: string;
  establishmentId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Registra uma acao no audit log
 */
export async function auditLog(data: AuditLogData): Promise<void> {
  try {
    // Determina severidade automaticamente se nao fornecida
    const severity = data.severity || getSeverity(data.action);
    
    // Salva no banco de dados
    await prisma.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId,
        establishmentId: data.establishmentId,
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent?.slice(0, 500),
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        details: data.details ? JSON.stringify(data.details) : null,
        severity,
        createdAt: new Date(),
      },
    });
    
    // Log critico tambem no console para monitoramento
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      console.warn(`[AUDIT ${severity}] ${data.action}`, {
        userId: data.userId,
        ip: data.ipAddress,
        details: data.details,
      });
    }
  } catch (error) {
    // Nunca deixa falha de audit log quebrar a aplicacao
    console.error('[AUDIT] Erro ao registrar log:', error);
  }
}

/**
 * Determina severidade baseado na acao
 */
function getSeverity(action: AuditAction): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const severityMap: Record<AuditAction, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    LOGIN_SUCCESS: 'LOW',
    LOGIN_FAILED: 'MEDIUM',
    LOGOUT: 'LOW',
    REGISTER: 'LOW',
    PASSWORD_RESET_REQUEST: 'MEDIUM',
    PASSWORD_RESET_SUCCESS: 'MEDIUM',
    PASSWORD_CHANGE: 'MEDIUM',
    SUBSCRIPTION_CREATED: 'MEDIUM',
    SUBSCRIPTION_CANCELLED: 'MEDIUM',
    PAYMENT_SUCCESS: 'LOW',
    PAYMENT_FAILED: 'MEDIUM',
    APPOINTMENT_CREATED: 'LOW',
    APPOINTMENT_CANCELLED: 'LOW',
    PROFESSIONAL_CREATED: 'LOW',
    PROFESSIONAL_DELETED: 'MEDIUM',
    SERVICE_CREATED: 'LOW',
    SERVICE_DELETED: 'MEDIUM',
    SETTINGS_CHANGED: 'MEDIUM',
    WHATSAPP_CONNECTED: 'MEDIUM',
    WHATSAPP_DISCONNECTED: 'MEDIUM',
    RATE_LIMIT_EXCEEDED: 'HIGH',
    UNAUTHORIZED_ACCESS: 'HIGH',
    SUSPICIOUS_ACTIVITY: 'CRITICAL',
  };
  
  return severityMap[action] || 'LOW';
}

/**
 * Helper para extrair info do request
 */
export function getRequestInfo(request: Request) {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               request.headers.get('x-real-ip') ||
               'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * Busca logs de auditoria (para admin)
 */
export async function getAuditLogs(options: {
  userId?: string;
  establishmentId?: string;
  action?: AuditAction;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const { page = 1, limit = 50 } = options;
  
  const where: Record<string, unknown> = {};
  
  if (options.userId) where.userId = options.userId;
  if (options.establishmentId) where.establishmentId = options.establishmentId;
  if (options.action) where.action = options.action;
  if (options.severity) where.severity = options.severity;
  if (options.startDate || options.endDate) {
    where.createdAt = {
      ...(options.startDate && { gte: options.startDate }),
      ...(options.endDate && { lte: options.endDate }),
    };
  }
  
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
