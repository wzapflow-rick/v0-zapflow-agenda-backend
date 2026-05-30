import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

// Admin credentials - password is hashed with bcrypt (12 rounds)
const ADMIN_CREDENTIALS = {
  email: 'admin@zapflow.com',
  passwordHash: '$2b$12$Hz8VUaIMlZV49EJTlMZQW.s9khTacweQMFSyWF42OlNLgxkU5kAQq',
  name: 'Administrador ZapFlow'
}

const JWT_SECRET = process.env.JWT_SECRET || 'zapflow-admin-secret-key-change-in-production'
const ADMIN_TOKEN_NAME = 'zapflow_admin_token'

export interface AdminUser {
  email: string
  name: string
}

export async function validateAdminCredentials(email: string, password: string): Promise<AdminUser | null> {
  if (email !== ADMIN_CREDENTIALS.email) {
    return null
  }

  const isValidPassword = await bcrypt.compare(password, ADMIN_CREDENTIALS.passwordHash)
  
  if (!isValidPassword) {
    return null
  }

  return {
    email: ADMIN_CREDENTIALS.email,
    name: ADMIN_CREDENTIALS.name
  }
}

export function generateAdminToken(admin: AdminUser): string {
  return jwt.sign(
    { 
      email: admin.email, 
      name: admin.name,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  )
}

export function verifyAdminToken(token: string): AdminUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminUser & { role: string }
    if (decoded.role !== 'admin') {
      return null
    }
    return { email: decoded.email, name: decoded.name }
  } catch {
    return null
  }
}

export async function getAdminFromCookies(): Promise<AdminUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_TOKEN_NAME)?.value
  
  if (!token) {
    return null
  }

  return verifyAdminToken(token)
}

export function getAdminTokenName(): string {
  return ADMIN_TOKEN_NAME
}
