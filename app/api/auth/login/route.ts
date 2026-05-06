import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { success, handleError, ApiError } from '@/lib/api-utils';
import { loginSchema } from '@/lib/validators';

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    // Busca usuário pelo email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        establishment: true,
      },
    });

    if (!user) {
      throw new ApiError('Email ou senha inválidos', 401);
    }

    // Verifica a senha
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new ApiError('Email ou senha inválidos', 401);
    }

    // Gera token
    const token = generateToken({ userId: user.id, email: user.email });

    // Remove senha do retorno
    const { password: _, ...userWithoutPassword } = user;

    return success({
      user: {
        ...userWithoutPassword,
        establishmentId: user.establishment?.id,
      },
      token,
    });
  } catch (error) {
    return handleError(error);
  }
}
