/**
 * Confirmations - Fluxo de confirmacao de agendamento via WhatsApp
 *
 * O envio das mensagens (Evolution API) acontece no FRONTEND.
 * O backend apenas guarda estado, calcula quais acoes estao "due"
 * e recebe o relatorio do que foi executado.
 */

// Status possiveis de confirmacao (armazenados em lowercase)
export type ConfirmationStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'cancelled'
  | 'expired';

// Acoes que o cron (frontend) precisa executar
export type ConfirmationAction =
  | 'send_reservation'
  | 'send_confirmation_request'
  | 'send_confirmation_reminder'
  | 'cancel_no_confirmation'
  | 'send_final_reminder';

// Chaves dos modelos de mensagem configurados por estabelecimento
export type TemplateKey =
  | 'reservation_created'
  | 'confirmation_request'
  | 'confirmation_reminder'
  | 'confirmation_cancelled'
  | 'final_reminder';

export interface ConfirmationTemplates {
  reservation_created: string;
  confirmation_request: string;
  confirmation_reminder: string;
  confirmation_cancelled: string;
  final_reminder: string;
}

export interface ConfirmationSettingsData {
  enabled: boolean;
  leadTimeHours: number;
  templates: ConfirmationTemplates;
}

// Templates padrao (apenas IDs vazios)
export const DEFAULT_TEMPLATES: ConfirmationTemplates = {
  reservation_created: '',
  confirmation_request: '',
  confirmation_reminder: '',
  confirmation_cancelled: '',
  final_reminder: '',
};

export const DEFAULT_LEAD_TIME_HOURS = 24;

// Mapeia cada acao para a chave do template correspondente
export const ACTION_TEMPLATE_MAP: Record<ConfirmationAction, TemplateKey> = {
  send_reservation: 'reservation_created',
  send_confirmation_request: 'confirmation_request',
  send_confirmation_reminder: 'confirmation_reminder',
  cancel_no_confirmation: 'confirmation_cancelled',
  send_final_reminder: 'final_reminder',
};

// Normaliza o JSON de templates do banco garantindo todas as chaves
export function normalizeTemplates(raw: unknown): ConfirmationTemplates {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    reservation_created: typeof source.reservation_created === 'string' ? source.reservation_created : '',
    confirmation_request: typeof source.confirmation_request === 'string' ? source.confirmation_request : '',
    confirmation_reminder: typeof source.confirmation_reminder === 'string' ? source.confirmation_reminder : '',
    confirmation_cancelled: typeof source.confirmation_cancelled === 'string' ? source.confirmation_cancelled : '',
    final_reminder: typeof source.final_reminder === 'string' ? source.final_reminder : '',
  };
}

/**
 * Calcula o offset (em ms) de um timezone para uma data especifica.
 * Retorna quanto somar ao UTC para obter o horario local: local = utc + offset.
 */
function getTimezoneOffsetMs(timeZone: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    // Intl pode retornar "24" para meia-noite em alguns ambientes
    const hour = map.hour === '24' ? '0' : map.hour;
    const asUTC = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(hour),
      Number(map.minute),
      Number(map.second)
    );
    return asUTC - date.getTime();
  } catch {
    return 0;
  }
}

/**
 * Converte a data + horario (wall-clock no timezone do estabelecimento)
 * em um instante UTC real (Date).
 *
 * - `date` vem do Prisma como @db.Date (UTC midnight do dia)
 * - `startTime` vem do Prisma como @db.Time (1970-01-01 com o horario em UTC)
 */
export function getAppointmentInstant(date: Date, startTime: Date, timeZone: string): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hour = startTime.getUTCHours();
  const minute = startTime.getUTCMinutes();

  // Primeira aproximacao tratando o wall-clock como UTC
  const guess = Date.UTC(year, month, day, hour, minute);
  const offset = getTimezoneOffsetMs(timeZone, new Date(guess));
  return new Date(guess - offset);
}

// Formata um Date (@db.Date) como YYYY-MM-DD usando componentes UTC
export function formatDateYMD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Formata um Date (@db.Time) como HH:MM usando componentes UTC
export function formatTimeHM(time: Date): string {
  const h = String(time.getUTCHours()).padStart(2, '0');
  const m = String(time.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export const HOUR_MS = 60 * 60 * 1000;

/**
 * Verifica o token de servico (Bearer) usado pelo cron do frontend.
 * Usa o header Authorization: Bearer <CONFIRMATION_SERVICE_TOKEN>.
 */
export function verifyServiceToken(authHeader: string | null): boolean {
  const token = process.env.CONFIRMATION_SERVICE_TOKEN;
  if (!token) return false;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  return authHeader.substring(7) === token;
}
