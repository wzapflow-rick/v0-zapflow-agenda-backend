import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { AppError, ValidationError } from './utils/errors';
import { ZodError } from 'zod';

// Import routes
import authRoutes from './routes/auth.routes';
import establishmentsRoutes from './routes/establishments.routes';
import professionalsRoutes from './routes/professionals.routes';
import servicesRoutes from './routes/services.routes';
import clientsRoutes from './routes/clients.routes';
import appointmentsRoutes from './routes/appointments.routes';
import subscriptionsRoutes from './routes/subscriptions.routes';
import publicRoutes from './routes/public.routes';

const app = express();

// Middlewares de segurança
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Parser de JSON (exceto para webhook do Stripe que precisa do body raw)
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/establishments', establishmentsRoutes);
app.use('/api/professionals', professionalsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/public', publicRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
  });
});

// Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  // Erro de validação do Zod
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors,
    });
  }

  // Erro de validação customizado
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  // Erros da aplicação
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Erros do Prisma
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      success: false,
      message: 'Erro no banco de dados',
    });
  }

  // Erro genérico
  return res.status(500).json({
    success: false,
    message: config.nodeEnv === 'development' ? err.message : 'Erro interno do servidor',
  });
});

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
  🚀 Servidor rodando na porta ${PORT}
  📍 Health check: http://localhost:${PORT}/health
  📚 API: http://localhost:${PORT}/api
  
  Rotas disponíveis:
  - POST   /api/auth/register
  - POST   /api/auth/login
  - GET    /api/auth/me
  
  - GET    /api/establishments/:id
  - PUT    /api/establishments/:id
  
  - POST   /api/professionals
  - GET    /api/professionals
  - GET    /api/professionals/:id
  - PUT    /api/professionals/:id
  - DELETE /api/professionals/:id
  
  - POST   /api/services
  - GET    /api/services
  - GET    /api/services/:id
  - PUT    /api/services/:id
  - DELETE /api/services/:id
  
  - POST   /api/clients
  - GET    /api/clients
  - GET    /api/clients/:id
  - PUT    /api/clients/:id
  - DELETE /api/clients/:id
  
  - POST   /api/appointments
  - GET    /api/appointments
  - GET    /api/appointments/available-slots
  - GET    /api/appointments/:id
  - PUT    /api/appointments/:id
  - DELETE /api/appointments/:id
  
  - GET    /api/subscriptions/plans
  - GET    /api/subscriptions/current
  - GET    /api/subscriptions/limits
  - POST   /api/subscriptions/checkout
  - POST   /api/subscriptions/cancel
  - POST   /api/subscriptions/webhook
  
  Endpoints Públicos:
  - GET    /api/public/establishments/:slug
  - GET    /api/public/establishments/:slug/services
  - GET    /api/public/establishments/:slug/professionals
  - GET    /api/public/establishments/:slug/available-slots
  - POST   /api/public/establishments/:slug/appointments
  `);
});

export default app;
