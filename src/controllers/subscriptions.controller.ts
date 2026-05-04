import { Request, Response, NextFunction } from 'express';
import { subscriptionsService } from '../services/subscriptions.service';
import { checkoutSchema } from '../utils/validators';
import { ApiResponse } from '../types';

export const subscriptionsController = {
  // GET /api/subscriptions/plans - Listar planos disponíveis
  async listPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await subscriptionsService.listPlans();

      const response: ApiResponse = {
        success: true,
        data: plans,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/subscriptions/current - Obter assinatura atual
  async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const subscription = await subscriptionsService.getCurrent(userId);

      const response: ApiResponse = {
        success: true,
        data: subscription,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/subscriptions/checkout - Iniciar checkout
  async checkout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { planId } = checkoutSchema.parse(req.body);

      const result = await subscriptionsService.checkout(userId, planId);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/subscriptions/webhook - Receber webhook do gateway
  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string | undefined;
      
      // NOTA: Em produção, o body deve ser raw para validar a assinatura
      const result = await subscriptionsService.handleWebhook(req.body, signature);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/subscriptions/cancel - Cancelar assinatura
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const subscription = await subscriptionsService.cancel(userId);

      const response: ApiResponse = {
        success: true,
        data: subscription,
        message: 'Assinatura cancelada com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/subscriptions/limits - Verificar limites do plano
  async getLimits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const limits = await subscriptionsService.checkPlanLimits(userId);

      const response: ApiResponse = {
        success: true,
        data: limits,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
};
