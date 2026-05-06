import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { success, handleError } from '@/lib/api-utils';
import { registerSchema } from '@/lib/validators';

// POST /api/auth/register
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    // Verifica se o email já está em uso
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return success({ error: 'Email já está em uso' }, 409);
    }

    // Cria slug único para o estabelecimento
    const baseSlug = data.establishmentName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.establishment.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Horário de funcionamento padrão
    const defaultBusinessHours = {
      monday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      tuesday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      wednesday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      thursday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      friday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      saturday: { isOpen: true, openTime: '09:00', closeTime: '13:00' },
      sunday: { isOpen: false, openTime: '09:00', closeTime: '18:00' },
    };

    // Cria usuário com estabelecimento
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
            businessHours: defaultBusinessHours,
          },
        },
      },
      include: {
        establishment: true,
      },
    });

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
    }, 201);
  } catch (error) {
    return handleError(error);
  }
}
