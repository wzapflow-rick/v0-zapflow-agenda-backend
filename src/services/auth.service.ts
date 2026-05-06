import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../models/prisma';
import { config } from '../config';
import { RegisterInput, LoginInput } from '../utils/validators';
import { UnauthorizedError, ConflictError } from '../utils/errors';
import { AuthenticatedUser } from '../types';

// Gera slug único a partir do nome do estabelecimento
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífen
    .replace(/^-|-$/g, ''); // Remove hífens no início e fim
};

// Verifica se o slug é único, se não, adiciona um sufixo numérico
const ensureUniqueSlug = async (baseSlug: string): Promise<string> => {
  let slug = baseSlug;
  let counter = 1;

  while (await prisma.establishment.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

export const authService = {
  // Registrar novo usuário e estabelecimento
  async register(data: RegisterInput) {
    // Verifica se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('Email já cadastrado');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(data.password, config.saltRounds);

    // Gera slug único para o estabelecimento
    const slug = await ensureUniqueSlug(generateSlug(data.establishmentName));

    // Cria usuário e estabelecimento em uma transação
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        phone: data.phone,
        establishment: {
          create: {
            name: data.establishmentName,
            slug,
            // Horários padrão de funcionamento (segunda a sábado, 9h às 18h)
            businessHours: {
              monday: { open: '09:00', close: '18:00', enabled: true },
              tuesday: { open: '09:00', close: '18:00', enabled: true },
              wednesday: { open: '09:00', close: '18:00', enabled: true },
              thursday: { open: '09:00', close: '18:00', enabled: true },
              friday: { open: '09:00', close: '18:00', enabled: true },
              saturday: { open: '09:00', close: '13:00', enabled: true },
              sunday: { open: '09:00', close: '18:00', enabled: false },
            },
          },
        },
      },
      include: {
        establishment: true,
      },
    });

    // Gera token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    // Retorna usuário sem a senha
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  },

  // Login de usuário
  async login(data: LoginInput) {
    console.log('[v0] Login iniciado para:', data.email);
    
    // Busca usuário pelo email
    console.log('[v0] Buscando usuário no banco...');
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        establishment: true,
      },
    });
    console.log('[v0] Usuário encontrado:', !!user);

    if (!user) {
      throw new UnauthorizedError('Email ou senha inválidos');
    }

    // Verifica a senha
    console.log('[v0] Verificando senha...');
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    console.log('[v0] Senha válida:', isPasswordValid);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Email ou senha inválidos');
    }

    // Gera token JWT
    console.log('[v0] Gerando token JWT...');
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
    console.log('[v0] Token gerado com sucesso');

    // Retorna usuário sem a senha
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  },

  // Obter dados do usuário autenticado
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        establishment: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    // Retorna usuário sem a senha e com establishmentId no nível raiz
    const { password: _, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      establishmentId: user.establishmentId,
    };
  },
};
