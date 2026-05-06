import { Router } from 'express';
import { establishmentsController } from '../controllers/establishments.controller';
import { authenticate, requireEstablishment } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/establishments/me - Obter meu estabelecimento
router.get('/me', establishmentsController.getMine);

// GET /api/establishments/:id - Obter detalhes do estabelecimento
router.get('/:id', establishmentsController.getById);

// PUT /api/establishments/:id - Atualizar estabelecimento
router.put('/:id', establishmentsController.update);

// PUT /api/establishments/me - Atualizar meu estabelecimento (atalho)
router.put('/me', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const establishment = await require('../services/establishments.service').establishmentsService.getMine(userId);
    req.params.id = establishment.id;
    return establishmentsController.update(req, res, next);
  } catch (error) {
    next(error);
  }
});

export default router;
