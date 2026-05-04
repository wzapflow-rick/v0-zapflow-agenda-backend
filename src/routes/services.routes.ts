import { Router } from 'express';
import { servicesController } from '../controllers/services.controller';
import { authenticate, requireEstablishment } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação e estabelecimento
router.use(authenticate, requireEstablishment);

// POST /api/services - Criar serviço
router.post('/', servicesController.create);

// GET /api/services - Listar serviços
router.get('/', servicesController.list);

// GET /api/services/:id - Obter serviço
router.get('/:id', servicesController.getById);

// PUT /api/services/:id - Atualizar serviço
router.put('/:id', servicesController.update);

// DELETE /api/services/:id - Deletar serviço
router.delete('/:id', servicesController.delete);

export default router;
