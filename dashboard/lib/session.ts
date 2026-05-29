import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET ?? 'dev-secret-min-32-chars-change-me!!')

export const COOKIE = 'ws_session'

export interface Session {
  workspaceId: string
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return { workspaceId: payload.workspaceId as string }
  } catch {
    return null
  }
}

export async function makeSessionToken(workspaceId: string): Promise<string> {
  return new SignJWT({ workspaceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return { workspaceId: payload.workspaceId as string }
  } catch {
    return null
  }
}
