import { Request, Response, NextFunction } from 'express';
import { professionalsService } from '../services/professionals.service';
import { createProfessionalSchema, updateProfessionalSchema, paginationSchema } from '../utils/validators';
import { ApiResponse } from '../types';

export const professionalsController = {
  // POST /api/professionals
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const establishmentId = req.user!.establishmentId!;
      const validatedData = createProfessionalSchema.parse(req.body);

      const professional = await professionalsService.create(establishmentId, validatedData);

      const response: ApiResponse = {
        success: true,
        data: professional,
        message: 'Profissional criado com sucesso',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/professionals
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const establishmentId = req.user!.establishmentId!;
      const pagination = paginationSchema.parse(req.query);

      const result = await professionalsService.list(establishmentId, pagination);

      const response: ApiResponse = {
        success: true,
        data: result.data,
        ...result.pagination,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/professionals/:id
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;

      const professional = await professionalsService.getById(id, establishmentId);

      const response: ApiResponse = {
        success: true,
        data: professional,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/professionals/:id
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;
      const validatedData = updateProfessionalSchema.parse(req.body);

      const professional = await professionalsService.update(id, establishmentId, validatedData);

      const response: ApiResponse = {
        success: true,
        data: professional,
        message: 'Profissional atualizado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/professionals/:id
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;

      await professionalsService.delete(id, establishmentId);

      const response: ApiResponse = {
        success: true,
        message: 'Profissional deletado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
};
