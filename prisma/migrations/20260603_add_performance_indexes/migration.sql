-- Migration: Adicionar índices de performance
-- Data: 2026-06-03
-- Fase: 0.5 do plano de escalabilidade

-- ===========================================
-- ÍNDICES PARA APPOINTMENTS (TABELA CRÍTICA)
-- ===========================================

-- Índice para busca por cliente
CREATE INDEX IF NOT EXISTS idx_appointments_client 
ON appointments ("clientId");

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_appointments_status 
ON appointments (status);

-- Índice composto para query de slots (mais usada)
-- Otimiza: findFirst({ where: { professionalId, date, status } })
CREATE INDEX IF NOT EXISTS idx_appointments_slots_query 
ON appointments ("professionalId", date, status, "startTime", "endTime");

-- Índice para ordenação por data de criação
CREATE INDEX IF NOT EXISTS idx_appointments_created 
ON appointments ("createdAt" DESC);

-- ===========================================
-- ÍNDICES PARA SUBSCRIPTIONS
-- ===========================================

-- Índice para busca de trials ativos
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends 
ON subscriptions ("trialEndsAt") 
WHERE status = 'TRIALING';

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
ON subscriptions (status);

-- ===========================================
-- ÍNDICES PARA CLIENTS
-- ===========================================

-- Índice para busca por estabelecimento (listagem)
CREATE INDEX IF NOT EXISTS idx_clients_establishment 
ON clients ("establishmentId");

-- Índice para busca por telefone (lookup)
CREATE INDEX IF NOT EXISTS idx_clients_phone 
ON clients (phone);

-- ===========================================
-- ÍNDICES PARA SERVICES
-- ===========================================

-- Índice para busca por estabelecimento
CREATE INDEX IF NOT EXISTS idx_services_establishment 
ON services ("establishmentId");

-- ===========================================
-- ÍNDICES PARA PROFESSIONALS
-- ===========================================

-- Índice para busca por estabelecimento
CREATE INDEX IF NOT EXISTS idx_professionals_establishment 
ON professionals ("establishmentId");

-- ===========================================
-- ÍNDICES PARA NOTIFICATIONS
-- ===========================================

-- Índice para listagem de notificações não lidas
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON notifications ("establishmentId", read, "createdAt" DESC);

-- ===========================================
-- ÍNDICES PARA MESSAGE_LOGS
-- ===========================================

-- Índice para busca por appointment
CREATE INDEX IF NOT EXISTS idx_message_logs_appointment 
ON message_logs ("appointmentId");

-- ===========================================
-- ÍNDICES PARA AUDIT_LOGS
-- ===========================================

-- Índice para busca por recurso
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
ON audit_logs ("resourceType", "resourceId");

-- ===========================================
-- VERIFICAR ÍNDICES CRIADOS
-- ===========================================
-- Para verificar: SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
