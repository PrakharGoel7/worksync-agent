import { NextRequest, NextResponse } from 'next/server'
import { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET } from '@/lib/env'
import { saveWorkspace, getWorkspace } from '@/lib/db'
import { makeSessionToken, COOKIE } from '@/lib/session'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/login?error=cancelled', req.url))
  }

  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/login?error=misconfigured', req.url))
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const redirectUri = `${base}/api/auth/callback`

  // Exchange code for bot token
  const params = new URLSearchParams({
    code,
    client_id: SLACK_CLIENT_ID,
    client_secret: SLACK_CLIENT_SECRET,
    redirect_uri: redirectUri,
  })

  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = await tokenRes.json()

  if (!data.ok) {
    console.error('Slack OAuth error:', data.error)
    return NextResponse.redirect(new URL('/login?error=slack_error', req.url))
  }

  const workspaceId: string = data.team.id
  const teamName: string = data.team.name
  const botToken: string = data.access_token
  const authedUserId: string = data.authed_user?.id ?? ''

  await saveWorkspace({ id: workspaceId, teamName, botToken, authedUserId })

  const sessionToken = await makeSessionToken(workspaceId)

  // Always go to onboarding — it handles already-configured workspaces too
  const res = NextResponse.redirect(new URL('/onboarding', req.url))
  res.cookies.set(COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
