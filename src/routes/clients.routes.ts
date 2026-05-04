import { Router } from 'express';
import { clientsController } from '../controllers/clients.controller';
import { authenticate, requireEstablishment } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação e estabelecimento
router.use(authenticate, requireEstablishment);

// POST /api/clients - Criar cliente
router.post('/', clientsController.create);

// GET /api/clients - Listar clientes
router.get('/', clientsController.list);

// GET /api/clients/:id - Obter cliente
router.get('/:id', clientsController.getById);

// PUT /api/clients/:id - Atualizar cliente
router.put('/:id', clientsController.update);

// DELETE /api/clients/:id - Deletar cliente
router.delete('/:id', clientsController.delete);

export default router;
