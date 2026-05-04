import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../models/prisma';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { JwtPayload, AuthenticatedUser } from '../types';

// Middleware de autenticação JWT
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acesso não fornecido');
    }

    const token = authHeader.split(' ')[1];

    // Verifica e decodifica o token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Busca o usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        establishment: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    // Adiciona o usuário ao request
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      establishmentId: user.establishment?.id,
    };

    req.user = authenticatedUser;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Token inválido'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expirado'));
    } else {
      next(error);
    }
  }
};

// Middleware para verificar se o usuário tem um estabelecimento
export const requireEstablishment = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Usuário não autenticado');
    }

    if (!req.user.establishmentId) {
      throw new ForbiddenError('Usuário não possui um estabelecimento cadastrado');
    }

    // Carrega o estabelecimento completo se necessário
    const establishment = await prisma.establishment.findUnique({
      where: { id: req.user.establishmentId },
    });

    if (!establishment) {
      throw new ForbiddenError('Estabelecimento não encontrado');
    }

    req.establishment = establishment;

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware opcional de autenticação (não falha se não houver token)
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          establishment: {
            select: { id: true },
          },
        },
      });

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          establishmentId: user.establishment?.id,
        };
      }
    } catch {
      // Token inválido, mas não falha pois é opcional
    }

    next();
  } catch (error) {
    next(error);
  }
};
