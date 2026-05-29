import { NextRequest, NextResponse } from 'next/server'
import { WebClient } from '@slack/web-api'
import { SLACK_BOT_TOKEN } from '@/lib/env'
import { getSession } from '@/lib/session'
import { getWorkspace } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { personName, message, userId: providedUserId } = await req.json()

  const session = await getSession()
  const ws = session ? await getWorkspace(session.workspaceId) : null
  const token = ws?.botToken ?? SLACK_BOT_TOKEN

  if (!token) {
    return NextResponse.json({ error: 'No bot token available' }, { status: 500 })
  }

  const slack = new WebClient(token)

  try {
    let userId: string | undefined = providedUserId || undefined

    if (!userId) {
      let cursor: string | undefined
      outer: while (true) {
        const res = await slack.users.list({ limit: 200, cursor })
        for (const user of res.members ?? []) {
          if (user.deleted || user.is_bot) continue
          const realName = user.profile?.real_name?.toLowerCase() ?? ''
          const displayName = user.profile?.display_name?.toLowerCase() ?? ''
          const target = personName.toLowerCase()
          if (realName === target || displayName === target ||
              realName.includes(target) || target.includes(realName.split(' ')[0])) {
            userId = user.id
            break outer
          }
        }
        cursor = (res.response_metadata as any)?.next_cursor
        if (!cursor) break
      }
    }

    if (!userId) {
      return NextResponse.json({ error: `Could not find Slack user matching "${personName}"` }, { status: 404 })
    }

    const dm = await slack.conversations.open({ users: userId })
    const channelId = (dm.channel as any).id
    await slack.chat.postMessage({ channel: channelId, text: message })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Slack error' }, { status: 500 })
  }
}
