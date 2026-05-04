import { Router } from 'express';
import { establishmentsController } from '../controllers/establishments.controller';
import { authenticate, requireEstablishment } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/establishments/:id - Obter detalhes do estabelecimento
router.get('/:id', establishmentsController.getById);

// PUT /api/establishments/:id - Atualizar estabelecimento
router.put('/:id', establishmentsController.update);

export default router;
