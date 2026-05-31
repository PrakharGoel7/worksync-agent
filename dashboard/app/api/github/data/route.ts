import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getWorkspace, getContributionDetails } from '@/lib/db'
import { getGithubData } from '@/lib/github'

export async function GET() {
  const session = await getSession()
  const ws = session ? await getWorkspace(session.workspaceId) : null

  let contributorNames: string[] = []
  if (session?.workspaceId) {
    try {
      const contribData = await getContributionDetails(session.workspaceId)
      contributorNames = contribData.contributors.slice(0, 7).map((c: any) => c.name).filter(Boolean)
    } catch { /* fall through */ }
  }

  const data = await getGithubData(ws?.githubToken, ws?.githubRepos, contributorNames)
  return NextResponse.json(data)
}
