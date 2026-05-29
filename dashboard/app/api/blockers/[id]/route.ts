import { NextRequest, NextResponse } from 'next/server'
import { updateBlocker, deleteBlocker, setBlockerStatus } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (body.status !== undefined) {
    await setBlockerStatus(parseInt(id, 10), body.status)
  } else {
    await updateBlocker(parseInt(id, 10), body.affected, body.affectedIds ?? '')
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteBlocker(parseInt(id, 10))
  return NextResponse.json({ ok: true })
}
