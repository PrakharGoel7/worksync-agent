import { NextResponse } from 'next/server'

const AGENT_URL = process.env.AGENT_URL ?? ''
const RUN_SECRET = process.env.RUN_SECRET ?? ''

export async function GET() {
  if (!AGENT_URL) return NextResponse.json({ running: false, error: 'no_agent_url' })
  try {
    const res = await fetch(`${AGENT_URL}/status`, {
      headers: { 'X-Run-Secret': RUN_SECRET },
    })
    if (!res.ok) return NextResponse.json({ running: true, error: `agent_${res.status}` })
    const data = await res.json()
    return NextResponse.json({ running: !!data.running })
  } catch (e: any) {
    return NextResponse.json({ running: true, error: e.message })
  }
}
