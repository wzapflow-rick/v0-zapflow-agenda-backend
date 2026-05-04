import { Router } from 'express';
import { subscriptionsController } from '../controllers/subscriptions.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/subscriptions/plans - Listar planos (público)
router.get('/plans', subscriptionsController.listPlans);

// POST /api/subscriptions/webhook - Webhook do gateway (público, mas validado por assinatura)
router.post('/webhook', subscriptionsController.webhook);

// Rotas autenticadas
router.use(authenticate);

// GET /api/subscriptions/current - Obter assinatura atual
router.get('/current', subscriptionsController.getCurrent);

// GET /api/subscriptions/limits - Verificar limites do plano
router.get('/limits', subscriptionsController.getLimits);

// POST /api/subscriptions/checkout - Iniciar checkout
router.post('/checkout', subscriptionsController.checkout);

// POST /api/subscriptions/cancel - Cancelar assinatura
router.post('/cancel', subscriptionsController.cancel);

export default router;
