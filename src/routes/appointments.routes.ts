import { Router } from 'express';
import { appointmentsController } from '../controllers/appointments.controller';
import { authenticate, requireEstablishment } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação e estabelecimento
router.use(authenticate, requireEstablishment);

// GET /api/appointments/available-slots - Buscar horários disponíveis (antes da rota :id)
router.get('/available-slots', appointmentsController.getAvailableSlots);

// POST /api/appointments - Criar agendamento
router.post('/', appointmentsController.create);

// GET /api/appointments - Listar agendamentos
router.get('/', appointmentsController.list);

// GET /api/appointments/:id - Obter agendamento
router.get('/:id', appointmentsController.getById);

// PUT /api/appointments/:id - Atualizar agendamento
router.put('/:id', appointmentsController.update);

// DELETE /api/appointments/:id - Cancelar agendamento
router.delete('/:id', appointmentsController.delete);

export default router;
