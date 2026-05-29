import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET ?? 'dev-secret-min-32-chars-change-me!!')

const PUBLIC = ['/login', '/api/auth/']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  const token = req.cookies.get('ws_session')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    await jwtVerify(token, secret())
    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('ws_session')
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
