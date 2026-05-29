import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getWorkspace } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ installed: false })
  const ws = await getWorkspace(session.workspaceId)
  return NextResponse.json({ installed: !!ws?.managerSlackId })
}
