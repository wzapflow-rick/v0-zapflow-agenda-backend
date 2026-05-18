-- =============================================================
-- SCRIPT DE MIGRACAO PARA PRODUCAO - ZapFlow Agenda Backend
-- =============================================================
-- Execute este script APENAS se o prisma db push nao funcionar
-- =============================================================

-- 1. Criar tipos ENUM se nao existirem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointmentstatus') THEN
        CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'planinterval') THEN
        CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptionstatus') THEN
        CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'messagelogstatus') THEN
        CREATE TYPE "MessageLogStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
    END IF;
END $$;

-- 2. Criar tabela plans se nao existir
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    interval "PlanInterval" DEFAULT 'MONTHLY',
    max_professionals INTEGER DEFAULT 1,
    max_services INTEGER DEFAULT 10,
    max_appointments INTEGER DEFAULT 100,
    features JSONB,
    trial_days INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Adicionar coluna password na tabela users se nao existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password') THEN
            ALTER TABLE users ADD COLUMN password VARCHAR(255);
        END IF;
    END IF;
END $$;

-- 4. Criar tabela users completa se nao existir
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 5. Criar tabela establishments se nao existir
CREATE TABLE IF NOT EXISTS establishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    logo TEXT,
    business_hours JSONB,
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    slot_duration INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_establishments_slug ON establishments(slug);
CREATE INDEX IF NOT EXISTS idx_establishments_user ON establishments(user_id);

-- 6. Criar tabela subscriptions se nao existir
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status "SubscriptionStatus" DEFAULT 'INACTIVE',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    gateway_subscription_id VARCHAR(255),
    gateway_customer_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id)
);

-- 7. Inserir planos padrao se a tabela estiver vazia
INSERT INTO plans (name, description, price, interval, max_professionals, max_services, max_appointments, features, trial_days, active)
SELECT 
    'Essencial',
    'Ideal para profissionais independentes que estao comecando a organizar sua agenda.',
    49.90,
    'MONTHLY'::"PlanInterval",
    1,
    999,
    100,
    '{
        "whatsappAutomations": 3,
        "bookingPage": true,
        "instagramBioLink": true,
        "onlinePayment": false,
        "financialDashboard": false,
        "prioritySupport": false,
        "recurringAppointments": false,
        "paymentSplit": false,
        "waitlist": false,
        "advancedBI": false,
        "retentionReports": false
    }'::jsonb,
    0,
    true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Essencial');

INSERT INTO plans (name, description, price, interval, max_professionals, max_services, max_appointments, features, trial_days, active)
SELECT 
    'Professional',
    'O favorito de barbearias e saloes que possuem equipe e querem reduzir as faltas.',
    119.90,
    'MONTHLY'::"PlanInterval",
    5,
    999,
    999999,
    '{
        "whatsappAutomations": 999,
        "bookingPage": true,
        "instagramBioLink": true,
        "onlinePayment": true,
        "financialDashboard": true,
        "prioritySupport": true,
        "recurringAppointments": false,
        "paymentSplit": false,
        "waitlist": false,
        "advancedBI": false,
        "retentionReports": false
    }'::jsonb,
    7,
    true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Professional');

INSERT INTO plans (name, description, price, interval, max_professionals, max_services, max_appointments, features, trial_days, active)
SELECT 
    'Elite',
    'Ideal para estabelecimentos de grande porte ou redes com multiplos profissionais.',
    249.90,
    'MONTHLY'::"PlanInterval",
    999,
    999,
    999999,
    '{
        "whatsappAutomations": 999,
        "bookingPage": true,
        "instagramBioLink": true,
        "onlinePayment": true,
        "financialDashboard": true,
        "prioritySupport": true,
        "recurringAppointments": true,
        "paymentSplit": true,
        "waitlist": true,
        "advancedBI": true,
        "retentionReports": true
    }'::jsonb,
    0,
    true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Elite');

-- 8. Verificar se tudo foi criado corretamente
SELECT 'plans' as table_name, count(*) as row_count FROM plans
UNION ALL
SELECT 'users' as table_name, count(*) as row_count FROM users
UNION ALL  
SELECT 'establishments' as table_name, count(*) as row_count FROM establishments;
