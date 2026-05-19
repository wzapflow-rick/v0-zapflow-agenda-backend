import { NextResponse } from 'next/server'
import { getAdminFromCookies } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getAdminFromCookies()
    
    if (!admin) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        email: admin.email,
        name: admin.name
      }
    })
  } catch (error) {
    console.error('Admin session check error:', error)
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    )
  }
}
