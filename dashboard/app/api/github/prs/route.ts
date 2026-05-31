import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getContributionDetails } from '@/lib/db'
import { generateUnifiedMockData } from '@/lib/github'

const STALE_DAYS = 3
const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

async function ghFetch(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  return res.json()
}

function resolveReviewState(reviews: any[], requestedReviewers: any[]) {
  const latest: Record<string, string> = {}
  for (const r of reviews ?? []) {
    if (r.state !== 'COMMENTED') latest[r.user.login] = r.state
  }
  const states = Object.values(latest)
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested' as const
  if (states.includes('APPROVED')) return 'approved' as const
  if (requestedReviewers?.length > 0) return 'pending' as const
  return 'none' as const
}

function resolveCIStatus(checkData: any) {
  const runs: any[] = checkData?.check_runs ?? []
  if (runs.length === 0) return 'none' as const
  const conclusions = runs.map(r => r.conclusion ?? r.status)
  if (conclusions.some(c => c === 'failure' || c === 'timed_out' || c === 'cancelled')) return 'failure' as const
  if (conclusions.some(c => c === 'in_progress' || c === 'queued' || c === 'waiting')) return 'pending' as const
  if (conclusions.every(c => c === 'success' || c === 'skipped' || c === 'neutral')) return 'success' as const
  return 'pending' as const
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN
  const reposEnv = process.env.GITHUB_REPOS

  if (!token || !reposEnv) {
    // Only show mock PRs if Slack data exists
    let names: string[] = []
    try {
      const session = await getSession()
      if (session?.workspaceId) {
        const data = await getContributionDetails(session.workspaceId)
        const fetched = data.contributors.slice(0, 7).map((c: any) => c.name).filter(Boolean)
        if (fetched.length > 0) names = fetched
      }
    } catch { /* fall through */ }

    if (names.length === 0) {
      return NextResponse.json({ prs: [], connected: false, hasSlackData: false })
    }

    const { openPRs } = generateUnifiedMockData(names)
    return NextResponse.json({ prs: openPRs, connected: false, hasSlackData: true })
  }

  const repos = reposEnv.split(',').map(r => r.trim()).filter(Boolean)

  const allPRs = (await Promise.all(repos.map(async repo => {
    const [owner, name] = repo.split('/')
    const prs = await ghFetch(`/repos/${owner}/${name}/pulls?state=open&per_page=50`, token)
    if (!prs) return []

    return Promise.all(prs.map(async (pr: any) => {
      const sha = pr.head.sha
      const [reviews, detail, checkData] = await Promise.all([
        ghFetch(`/repos/${owner}/${name}/pulls/${pr.number}/reviews`, token),
        ghFetch(`/repos/${owner}/${name}/pulls/${pr.number}`, token),
        ghFetch(`/repos/${owner}/${name}/commits/${sha}/check-runs?per_page=50`, token),
      ])

      const reviewState = resolveReviewState(reviews ?? [], pr.requested_reviewers)
      const ciStatus = resolveCIStatus(checkData)
      const daysSinceUpdate = (Date.now() - new Date(pr.updated_at).getTime()) / 86400000

      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        repo,
        repoName: name,
        url: pr.html_url,
        updatedAt: pr.updated_at,
        draft: pr.draft as boolean,
        reviewState,
        ciStatus,
        stale: !pr.draft && daysSinceUpdate > STALE_DAYS,
        comments: (pr.comments ?? 0) + (pr.review_comments ?? 0),
        additions: detail?.additions ?? null,
        deletions: detail?.deletions ?? null,
        changedFiles: detail?.changed_files ?? null,
      }
    }))
  }))).flat()

  return NextResponse.json({ prs: allPRs, connected: true })
}
