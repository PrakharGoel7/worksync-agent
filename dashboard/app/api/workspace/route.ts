import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getWorkspace, updateWorkspaceConfig } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(session.workspaceId)
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  return NextResponse.json({
    id: ws.id,
    teamName: ws.teamName,
    channels: ws.channels,
    managerSlackId: ws.managerSlackId,
    backfillDays: ws.backfillDays,
    scheduleInterval: ws.scheduleInterval,
    model: ws.model,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const update: { channels?: string[]; managerSlackId?: string; backfillDays?: number; scheduleInterval?: string; model?: string } = {}

  if (Array.isArray(body.channels)) update.channels = body.channels
  if (typeof body.managerSlackId === 'string') update.managerSlackId = body.managerSlackId
  if (typeof body.backfillDays === 'number') update.backfillDays = body.backfillDays
  if (typeof body.scheduleInterval === 'string') update.scheduleInterval = body.scheduleInterval
  if (typeof body.model === 'string') update.model = body.model

  await updateWorkspaceConfig(session.workspaceId, update)
  return NextResponse.json({ ok: true })
}
