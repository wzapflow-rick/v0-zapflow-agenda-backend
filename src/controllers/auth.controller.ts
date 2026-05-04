import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { registerSchema, loginSchema } from '../utils/validators';
import { ApiResponse } from '../types';

export const authController = {
  // POST /api/auth/register
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await authService.register(validatedData);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Usuário cadastrado com sucesso',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/auth/login
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await authService.login(validatedData);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Login realizado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/auth/me
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const user = await authService.getMe(userId);

      const response: ApiResponse = {
        success: true,
        data: user,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
};
