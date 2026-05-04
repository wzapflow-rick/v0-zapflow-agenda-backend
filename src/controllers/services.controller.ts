import { Request, Response, NextFunction } from 'express';
import { servicesService } from '../services/services.service';
import { createServiceSchema, updateServiceSchema, paginationSchema } from '../utils/validators';
import { ApiResponse } from '../types';

export const servicesController = {
  // POST /api/services
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const establishmentId = req.user!.establishmentId!;
      const validatedData = createServiceSchema.parse(req.body);

      const service = await servicesService.create(establishmentId, validatedData);

      const response: ApiResponse = {
        success: true,
        data: service,
        message: 'Serviço criado com sucesso',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/services
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const establishmentId = req.user!.establishmentId!;
      const pagination = paginationSchema.parse(req.query);

      const result = await servicesService.list(establishmentId, pagination);

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

  // GET /api/services/:id
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;

      const service = await servicesService.getById(id, establishmentId);

      const response: ApiResponse = {
        success: true,
        data: service,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/services/:id
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;
      const validatedData = updateServiceSchema.parse(req.body);

      const service = await servicesService.update(id, establishmentId, validatedData);

      const response: ApiResponse = {
        success: true,
        data: service,
        message: 'Serviço atualizado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/services/:id
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;

      await servicesService.delete(id, establishmentId);

      const response: ApiResponse = {
        success: true,
        message: 'Serviço deletado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
};
