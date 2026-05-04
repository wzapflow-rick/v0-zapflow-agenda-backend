import { Router } from 'express';
import { professionalsController } from '../controllers/professionals.controller';
import { authenticate, requireEstablishment } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação e estabelecimento
router.use(authenticate, requireEstablishment);

// POST /api/professionals - Criar profissional
router.post('/', professionalsController.create);

// GET /api/professionals - Listar profissionais
router.get('/', professionalsController.list);

// GET /api/professionals/:id - Obter profissional
router.get('/:id', professionalsController.getById);

// PUT /api/professionals/:id - Atualizar profissional
router.put('/:id', professionalsController.update);

// DELETE /api/professionals/:id - Deletar profissional
router.delete('/:id', professionalsController.delete);

export default router;
