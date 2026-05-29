import { NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(req: Request) {
  const session = await getSession()
  const { searchParams } = new URL(req.url)
  const channel = searchParams.get('channel') || undefined
  return NextResponse.json(await getDashboardData(session?.workspaceId, channel))
}
