import { Request, Response, NextFunction } from 'express';
import { establishmentsService } from '../services/establishments.service';
import { updateEstablishmentSchema } from '../utils/validators';
import { ApiResponse } from '../types';

export const establishmentsController = {
  // GET /api/establishments/me - Obter estabelecimento do usuário logado
  async getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const establishment = await establishmentsService.getMine(userId);

      const response: ApiResponse = {
        success: true,
        data: establishment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/establishments/:id
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const establishment = await establishmentsService.getById(id, userId);

      const response: ApiResponse = {
        success: true,
        data: establishment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/establishments/:id
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const validatedData = updateEstablishmentSchema.parse(req.body);

      const establishment = await establishmentsService.update(id, userId, validatedData);

      const response: ApiResponse = {
        success: true,
        data: establishment,
        message: 'Estabelecimento atualizado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
};
