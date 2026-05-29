import { NextResponse } from 'next/server'
import { COOKIE } from '@/lib/session'

export async function POST() {
  const res = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'))
  res.cookies.delete(COOKIE)
  return res
}

export async function GET() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE)
  return res
}
