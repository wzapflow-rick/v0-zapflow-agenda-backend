-- Migration: Proteção contra dupla reserva
-- Data: 2026-06-03
-- Fase: 2 do plano de escalabilidade

-- ===========================================
-- CONSTRAINT ÚNICA PARA AGENDAMENTOS
-- ===========================================
-- Esta é a ÚLTIMA LINHA DE DEFESA contra dupla reserva.
-- Funciona mesmo se o código falhar ou Redis estiver offline.

-- IMPORTANTE: Esta constraint impede duplicação EXATA (mesmo start_time).
-- NÃO impede sobreposições parciais (14:00-15:00 vs 14:30-15:30).
-- O algoritmo de conflito no código é necessário para sobreposições.

CREATE UNIQUE INDEX IF NOT EXISTS unique_appointment_slot
ON appointments (
  "professionalId",
  date,
  "startTime"
)
WHERE status NOT IN ('CANCELLED');

-- ===========================================
-- TABELA DE IDEMPOTÊNCIA PARA PAGAMENTOS
-- ===========================================
-- Persiste chaves de idempotência para operações financeiras.
-- Mais seguro que Redis para operações críticas.

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para limpeza de chaves antigas
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created 
ON idempotency_keys (created_at);

-- ===========================================
-- TABELA DE EVENTOS DE WEBHOOK
-- ===========================================
-- Persiste eventos de webhook ANTES de processar.
-- Garante que eventos não sejam perdidos.

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'RECEIVED',
  processed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para busca de eventos não processados
CREATE INDEX IF NOT EXISTS idx_webhook_events_status 
ON webhook_events (status, created_at);

-- ===========================================
-- LIMPEZA AUTOMÁTICA (RODAR VIA CRON)
-- ===========================================
-- Limpar chaves de idempotência antigas (> 7 dias)
-- DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '7 days';

-- Limpar eventos de webhook antigos (> 30 dias)
-- DELETE FROM webhook_events WHERE created_at < NOW() - INTERVAL '30 days';
