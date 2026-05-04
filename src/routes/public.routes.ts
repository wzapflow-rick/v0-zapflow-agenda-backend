import { Router } from 'express';
import { publicController } from '../controllers/public.controller';

const router = Router();

// GET /api/public/establishments/:slug - Obter estabelecimento pelo slug
router.get('/establishments/:slug', publicController.getEstablishment);

// GET /api/public/establishments/:slug/services - Listar serviços do estabelecimento
router.get('/establishments/:slug/services', publicController.getServices);

// GET /api/public/establishments/:slug/professionals - Listar profissionais do estabelecimento
router.get('/establishments/:slug/professionals', publicController.getProfessionals);

// GET /api/public/establishments/:slug/available-slots - Buscar horários disponíveis
router.get('/establishments/:slug/available-slots', publicController.getAvailableSlots);

// POST /api/public/establishments/:slug/appointments - Criar agendamento (público)
router.post('/establishments/:slug/appointments', publicController.createAppointment);

export default router;
