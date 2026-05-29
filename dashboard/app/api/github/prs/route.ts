import { NextResponse } from 'next/server'

const STALE_DAYS = 3
const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

type ReviewState = 'approved' | 'changes_requested' | 'pending' | 'none'
type CIStatus = 'success' | 'failure' | 'pending' | 'none'

async function ghFetch(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  return res.json()
}

function resolveReviewState(reviews: any[], requestedReviewers: any[]): ReviewState {
  const latest: Record<string, string> = {}
  for (const r of reviews ?? []) {
    if (r.state !== 'COMMENTED') latest[r.user.login] = r.state
  }
  const states = Object.values(latest)
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested'
  if (states.includes('APPROVED')) return 'approved'
  if (requestedReviewers?.length > 0) return 'pending'
  return 'none'
}

function resolveCIStatus(checkData: any): CIStatus {
  const runs: any[] = checkData?.check_runs ?? []
  if (runs.length === 0) return 'none'
  const conclusions = runs.map(r => r.conclusion ?? r.status)
  if (conclusions.some(c => c === 'failure' || c === 'timed_out' || c === 'cancelled')) return 'failure'
  if (conclusions.some(c => c === 'in_progress' || c === 'queued' || c === 'waiting')) return 'pending'
  if (conclusions.every(c => c === 'success' || c === 'skipped' || c === 'neutral')) return 'success'
  return 'pending'
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN
  const reposEnv = process.env.GITHUB_REPOS

  if (!token || !reposEnv) {
    return NextResponse.json({ error: 'missing_config' }, { status: 400 })
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
        authorAvatar: pr.user.avatar_url,
        repo,
        repoName: name,
        url: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        draft: pr.draft as boolean,
        reviewState,
        ciStatus,
        requestedReviewers: (pr.requested_reviewers ?? []).map((r: any) => r.login),
        stale: !pr.draft && daysSinceUpdate > STALE_DAYS,
        daysSinceUpdate: Math.floor(daysSinceUpdate),
        comments: (pr.comments ?? 0) + (pr.review_comments ?? 0),
        additions: detail?.additions ?? null,
        deletions: detail?.deletions ?? null,
        changedFiles: detail?.changed_files ?? null,
        commits: detail?.commits ?? null,
      }
    }))
  }))).flat()

  return NextResponse.json({ prs: allPRs })
}
