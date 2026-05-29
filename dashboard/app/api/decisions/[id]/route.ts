import { NextRequest, NextResponse } from 'next/server'
import { deleteDecision, setDecisionRead } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { read } = await req.json()
  await setDecisionRead(parseInt(id, 10), !!read)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteDecision(parseInt(id, 10))
  return NextResponse.json({ ok: true })
}
