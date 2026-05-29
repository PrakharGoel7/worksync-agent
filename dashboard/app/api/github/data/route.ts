import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getWorkspace } from '@/lib/db'
import { getGithubData } from '@/lib/github'

export async function GET() {
  const session = await getSession()
  const ws = session ? await getWorkspace(session.workspaceId) : null
  const data = await getGithubData(ws?.githubToken, ws?.githubRepos)
  return NextResponse.json(data)
}
