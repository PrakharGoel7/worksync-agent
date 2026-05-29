import { NextRequest, NextResponse } from 'next/server'
import { SLACK_CLIENT_ID } from '@/lib/env'

const SCOPES = [
  'channels:history',
  'channels:read',
  'channels:join',
  'groups:history',
  'groups:read',
  'im:write',
  'chat:write',
  'users:read',
].join(',')

export async function GET(req: NextRequest) {
  if (!SLACK_CLIENT_ID) {
    return NextResponse.json({ error: 'SLACK_CLIENT_ID not configured' }, { status: 500 })
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const redirectUri = `${base}/api/auth/callback`

  const url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', SLACK_CLIENT_ID)
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(url.toString())
}
