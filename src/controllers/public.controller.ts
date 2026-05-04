import { Request, Response, NextFunction } from 'express';
import { establishmentsService } from '../services/establishments.service';
import { appointmentsService } from '../services/appointments.service';
import { clientsService } from '../services/clients.service';
import { createPublicAppointmentSchema, availableSlotsQuerySchema } from '../utils/validators';
import { ApiResponse } from '../types';
import prisma from '../models/prisma';
import { NotFoundError } from '../utils/errors';

export const publicController = {
  // GET /api/public/establishments/:slug
  async getEstablishment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const establishment = await establishmentsService.getBySlug(slug);

      const response: ApiResponse = {
        success: true,
        data: establishment,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/public/establishments/:slug/services
  async getServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;

      // Busca o estabelecimento pelo slug
      const establishment = await prisma.establishment.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!establishment) {
        throw new NotFoundError('Estabelecimento');
      }

      // Lista serviços ativos
      const services = await prisma.service.findMany({
        where: {
          establishmentId: establishment.id,
          active: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          duration: true,
          price: true,
        },
        orderBy: { name: 'asc' },
      });

      const response: ApiResponse = {
        success: true,
        data: services,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/public/establishments/:slug/professionals
  async getProfessionals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const serviceId = req.query.serviceId as string | undefined;

      // Busca o estabelecimento pelo slug
      const establishment = await prisma.establishment.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!establishment) {
        throw new NotFoundError('Estabelecimento');
      }

      // Lista profissionais ativos (opcionalmente filtrados por serviço)
      const professionals = await prisma.professional.findMany({
        where: {
          establishmentId: establishment.id,
          active: true,
          ...(serviceId && {
            services: {
              some: {
                serviceId,
              },
            },
          }),
        },
        select: {
          id: true,
          name: true,
          avatar: true,
          bio: true,
        },
        orderBy: { name: 'asc' },
      });

      const response: ApiResponse = {
        success: true,
        data: professionals,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/public/establishments/:slug/available-slots
  async getAvailableSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const query = availableSlotsQuerySchema.parse(req.query);

      // Busca o estabelecimento pelo slug
      const establishment = await prisma.establishment.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!establishment) {
        throw new NotFoundError('Estabelecimento');
      }

      const slots = await appointmentsService.getAvailableSlots(establishment.id, query);

      const response: ApiResponse = {
        success: true,
        data: slots,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/public/appointments
  async createAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const validatedData = createPublicAppointmentSchema.parse(req.body);

      // Busca o estabelecimento pelo slug
      const establishment = await prisma.establishment.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!establishment) {
        throw new NotFoundError('Estabelecimento');
      }

      // Busca ou cria o cliente
      const client = await clientsService.findOrCreate(establishment.id, validatedData.client);

      // Cria o agendamento
      const appointment = await appointmentsService.create(establishment.id, {
        date: validatedData.date,
        startTime: validatedData.startTime,
        clientId: client.id,
        professionalId: validatedData.professionalId,
        serviceId: validatedData.serviceId,
        notes: validatedData.notes,
      });

      const response: ApiResponse = {
        success: true,
        data: appointment,
        message: 'Agendamento realizado com sucesso',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
};
