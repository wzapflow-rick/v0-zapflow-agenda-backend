import { Request, Response, NextFunction } from 'express';
import { clientsService } from '../services/clients.service';
import { createClientSchema, updateClientSchema, paginationSchema } from '../utils/validators';
import { ApiResponse } from '../types';

export const clientsController = {
  // POST /api/clients
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const establishmentId = req.user!.establishmentId!;
      const validatedData = createClientSchema.parse(req.body);

      const client = await clientsService.create(establishmentId, validatedData);

      const response: ApiResponse = {
        success: true,
        data: client,
        message: 'Cliente criado com sucesso',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/clients
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const establishmentId = req.user!.establishmentId!;
      const pagination = paginationSchema.parse(req.query);
      const search = req.query.search as string | undefined;

      const result = await clientsService.list(establishmentId, pagination, search);

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

  // GET /api/clients/:id
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;

      const client = await clientsService.getById(id, establishmentId);

      const response: ApiResponse = {
        success: true,
        data: client,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/clients/:id
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;
      const validatedData = updateClientSchema.parse(req.body);

      const client = await clientsService.update(id, establishmentId, validatedData);

      const response: ApiResponse = {
        success: true,
        data: client,
        message: 'Cliente atualizado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/clients/:id
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;

      await clientsService.delete(id, establishmentId);

      const response: ApiResponse = {
        success: true,
        message: 'Cliente deletado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
};
