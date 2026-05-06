import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Evita múltiplas instâncias do Prisma Client em desenvolvimento
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Configurações de timeout para evitar SocketTimeout
    connectionTimeoutMillis: 30000, // 30 segundos para conectar
    idleTimeoutMillis: 30000, // 30 segundos idle
    max: 10, // máximo de conexões no pool
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') 
      ? { rejectUnauthorized: false } 
      : undefined,
  });
  
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
