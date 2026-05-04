import { Request, Response, NextFunction } from 'express';
import { appointmentsService } from '../services/appointments.service';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  availableSlotsQuerySchema,
  appointmentFiltersSchema,
  paginationSchema,
} from '../utils/validators';
import { ApiResponse } from '../types';

export const appointmentsController = {
  // POST /api/appointments
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const establishmentId = req.user!.establishmentId!;
      const validatedData = createAppointmentSchema.parse(req.body);

      const appointment = await appointmentsService.create(establishmentId, validatedData);

      const response: ApiResponse = {
        success: true,
        data: appointment,
        message: 'Agendamento criado com sucesso',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/appointments
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const establishmentId = req.user!.establishmentId!;
      const pagination = paginationSchema.parse(req.query);
      const filters = appointmentFiltersSchema.parse(req.query);

      const result = await appointmentsService.list(establishmentId, filters, pagination);

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

  // GET /api/appointments/available-slots
  async getAvailableSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const establishmentId = req.user!.establishmentId!;
      const query = availableSlotsQuerySchema.parse(req.query);

      const slots = await appointmentsService.getAvailableSlots(establishmentId, query);

      const response: ApiResponse = {
        success: true,
        data: slots,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/appointments/:id
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;

      const appointment = await appointmentsService.getById(id, establishmentId);

      const response: ApiResponse = {
        success: true,
        data: appointment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/appointments/:id
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;
      const validatedData = updateAppointmentSchema.parse(req.body);

      const appointment = await appointmentsService.update(id, establishmentId, validatedData);

      const response: ApiResponse = {
        success: true,
        data: appointment,
        message: 'Agendamento atualizado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/appointments/:id
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const establishmentId = req.user!.establishmentId!;

      await appointmentsService.delete(id, establishmentId);

      const response: ApiResponse = {
        success: true,
        message: 'Agendamento cancelado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
};
