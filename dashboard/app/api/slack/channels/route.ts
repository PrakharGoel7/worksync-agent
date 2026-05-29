import { NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import { SLACK_BOT_TOKEN } from '@/lib/env'
import { getSession } from '@/lib/session'
import { getWorkspace } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  const ws = session ? await getWorkspace(session.workspaceId) : null
  const token = ws?.botToken ?? SLACK_BOT_TOKEN

  if (!token) {
    return NextResponse.json({ error: 'No bot token available' }, { status: 500 })
  }

  const slack = new WebClient(token)
  const channels: { id: string; name: string }[] = []
  let cursor: string | undefined

  while (true) {
    const res = await slack.conversations.list({
      limit: 200,
      cursor,
      types: 'public_channel,private_channel',
      exclude_archived: true,
    })
    for (const ch of res.channels ?? []) {
      if (ch.id && ch.name) channels.push({ id: ch.id, name: ch.name })
    }
    cursor = (res.response_metadata as any)?.next_cursor
    if (!cursor) break
  }

  return NextResponse.json({ channels: channels.sort((a, b) => a.name.localeCompare(b.name)) })
}
