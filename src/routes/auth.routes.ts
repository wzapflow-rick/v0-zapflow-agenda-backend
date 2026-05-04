import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/auth/register - Cadastro de novo usuário
router.post('/register', authController.register);

// POST /api/auth/login - Login de usuário
router.post('/login', authController.login);

// GET /api/auth/me - Obter dados do usuário autenticado (protegido)
router.get('/me', authenticate, authController.getMe);

export default router;
