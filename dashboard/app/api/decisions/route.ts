import { NextResponse } from 'next/server'
import { markAllDecisionsRead } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function POST() {
  const session = await getSession()
  await markAllDecisionsRead(session?.workspaceId)
  return NextResponse.json({ ok: true })
}
