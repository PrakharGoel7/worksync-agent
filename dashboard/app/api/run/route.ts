import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export const maxDuration = 300 // 5 minutes

const AGENT_URL = process.env.AGENT_URL ?? ''
const RUN_SECRET = process.env.RUN_SECRET ?? ''

export async function POST() {
  const session = await getSession()

  if (!AGENT_URL) {
    return NextResponse.json({ ok: false, error: 'Agent URL not configured' }, { status: 500 })
  }

  const url = new URL('/run', AGENT_URL)
  if (session?.workspaceId) url.searchParams.set('workspace', session.workspaceId)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'X-Run-Secret': RUN_SECRET },
  })

  if (res.status === 409) {
    return NextResponse.json({ ok: false, error: 'already_running' }, { status: 409 })
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: false, error: body.error ?? 'Agent error' }, { status: res.status })
  }

  return NextResponse.json({ ok: true })
}
