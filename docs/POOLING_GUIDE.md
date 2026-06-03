# Guia de Configuração de Pooling de Conexões

## Situação Atual

O projeto usa PostgreSQL hospedado em VPS própria. Em ambiente serverless (Vercel), cada request pode criar uma nova conexão com o banco, o que pode esgotar o limite de conexões do PostgreSQL (default: 100).

## Opções de Pooling

### Opção 1: PgBouncer na VPS (RECOMENDADO)

PgBouncer é um pooler leve que fica entre a aplicação e o PostgreSQL.

**Instalação na VPS:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install pgbouncer

# Configurar
sudo nano /etc/pgbouncer/pgbouncer.ini
```

**Configuração `/etc/pgbouncer/pgbouncer.ini`:**
```ini
[databases]
agenda = host=127.0.0.1 port=5432 dbname=agenda

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
```

**Criar arquivo de usuários `/etc/pgbouncer/userlist.txt`:**
```
"postgres" "senha_hash_md5"
```

Para gerar o hash:
```bash
echo -n "senhaPOSTGRES" | md5sum
# Formato: "usuario" "md5<hash>"
```

**Iniciar:**
```bash
sudo systemctl start pgbouncer
sudo systemctl enable pgbouncer
```

**Alterar DATABASE_URL no Vercel:**
```
# De:
DATABASE_URL=postgresql://postgres:senha@IP:5432/agenda

# Para:
DATABASE_URL=postgresql://postgres:senha@IP:6432/agenda
```

### Opção 2: Prisma Accelerate

Prisma Accelerate é um serviço gerenciado de pooling.

**Vantagens:**
- Zero configuração na VPS
- Edge caching integrado
- Monitoramento

**Desvantagens:**
- Custo adicional ($0.10 por 100k queries no plano pago)
- Dados passam por servidor da Prisma

**Configuração:**
1. Acessar https://console.prisma.io
2. Criar projeto e conexão com seu banco
3. Obter URL do Accelerate

```env
# Vercel
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
DIRECT_URL="postgresql://postgres:senha@IP:5432/agenda"
```

**Atualizar schema.prisma:**
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // Para migrations
}
```

### Opção 3: Neon Pooler (Se migrar para Neon)

Se decidir migrar o banco para Neon:

```env
# URL com pooling
DATABASE_URL="postgresql://user:pass@ep-xxx.pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# URL direta (para migrations)
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

## Recomendação

Para sua situação atual (VPS própria), recomendo **PgBouncer** porque:

1. Gratuito
2. Funciona localmente (menor latência)
3. Você mantém controle total
4. Fácil de configurar e monitorar

## Monitoramento de Conexões

**Ver conexões ativas no PostgreSQL:**
```sql
SELECT 
  datname,
  count(*) as connections,
  state
FROM pg_stat_activity 
GROUP BY datname, state
ORDER BY connections DESC;
```

**Ver limite de conexões:**
```sql
SHOW max_connections;
```

**Ver conexões por aplicação:**
```sql
SELECT 
  application_name,
  count(*) 
FROM pg_stat_activity 
GROUP BY application_name;
```

## Alertas

Configure alerta quando conexões > 80% do limite:

```sql
-- Criar função de monitoramento
SELECT 
  (SELECT count(*) FROM pg_stat_activity) as current,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max,
  ROUND(
    (SELECT count(*) FROM pg_stat_activity)::numeric / 
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') * 100
  , 2) as percentage;
```
