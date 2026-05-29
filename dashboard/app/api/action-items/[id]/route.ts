import { NextRequest, NextResponse } from 'next/server'
import { setActionItemStatus, updateActionItemOwner, deleteActionItem, updateActionItemDeadline } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const numId = parseInt(id, 10)
  if (body.status !== undefined) await setActionItemStatus(numId, body.status)
  if (body.owner !== undefined) await updateActionItemOwner(numId, body.owner, body.ownerIds ?? '')
  if (body.deadline !== undefined) await updateActionItemDeadline(numId, body.deadline)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteActionItem(parseInt(id, 10))
  return NextResponse.json({ ok: true })
}
