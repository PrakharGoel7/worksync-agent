export type ReviewState = 'approved' | 'changes_requested' | 'pending' | 'none'
export type CIStatus = 'success' | 'failure' | 'pending' | 'none'

export interface GithubPR {
  id: number
  number: number
  title: string
  author: string
  repo: string
  repoName: string
  url: string
  updatedAt: string
  draft: boolean
  reviewState: ReviewState
  ciStatus: CIStatus
  stale: boolean
  additions: number
  deletions: number
  changedFiles: number
  comments: number
}

export interface MemberGithubStats {
  prs: number
  additions: number
  deletions: number
  changedFiles: number
}

export interface GithubData {
  recentPRs: GithubPR[]
  linesPerWeek: Array<Record<string, string | number>>
  memberStats: Record<string, MemberGithubStats>
  connected: boolean
}

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PEOPLE = ['Prakhar', 'Sarah', 'Miroslav', 'Jordan', 'Alex']

function mockWeekStart(weeksAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() - weeksAgo * 7)
  return d.toISOString().slice(0, 10)
}

function seed(n: number): number {
  return Math.abs(((n * 1664525 + 1013904223) | 0) % 1000)
}

const MOCK_LINES_PER_WEEK = Array.from({ length: 8 }, (_, wi) => {
  const row: Record<string, string | number> = { date: mockWeekStart(7 - wi) }
  MOCK_PEOPLE.forEach((p, pi) => { row[p] = seed(wi * 17 + pi * 31) + 80 })
  return row
})

const MOCK_PRS: GithubPR[] = [
  {
    id: 1, number: 47, title: 'Implement OAuth2 flow for third-party integrations',
    author: 'Prakhar', repo: 'acme/api', repoName: 'api',
    url: '#', updatedAt: new Date(Date.now() - 86400000).toISOString(),
    draft: false, reviewState: 'pending', ciStatus: 'success',
    stale: false, additions: 892, deletions: 234, changedFiles: 12, comments: 3,
  },
  {
    id: 2, number: 46, title: 'Fix race condition in message queue processor',
    author: 'Sarah', repo: 'acme/api', repoName: 'api',
    url: '#', updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    draft: false, reviewState: 'approved', ciStatus: 'success',
    stale: false, additions: 45, deletions: 23, changedFiles: 3, comments: 5,
  },
  {
    id: 3, number: 45, title: 'Refactor database connection pooling',
    author: 'Miroslav', repo: 'acme/api', repoName: 'api',
    url: '#', updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    draft: false, reviewState: 'changes_requested', ciStatus: 'success',
    stale: false, additions: 312, deletions: 567, changedFiles: 8, comments: 11,
  },
  {
    id: 4, number: 44, title: 'Add end-to-end tests for checkout flow',
    author: 'Jordan', repo: 'acme/web', repoName: 'web',
    url: '#', updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    draft: false, reviewState: 'none', ciStatus: 'failure',
    stale: true, additions: 1240, deletions: 89, changedFiles: 18, comments: 2,
  },
  {
    id: 5, number: 43, title: 'Update dependencies and bump minor versions',
    author: 'Alex', repo: 'acme/web', repoName: 'web',
    url: '#', updatedAt: new Date(Date.now() - 86400000).toISOString(),
    draft: false, reviewState: 'approved', ciStatus: 'success',
    stale: false, additions: 12, deletions: 45, changedFiles: 3, comments: 0,
  },
]

const MOCK_MEMBER_STATS: Record<string, MemberGithubStats> = {
  Prakhar:  { prs: 12, additions: 4230, deletions: 1820, changedFiles: 67 },
  Sarah:    { prs: 8,  additions: 2100, deletions: 950,  changedFiles: 43 },
  Miroslav: { prs: 15, additions: 6780, deletions: 3210, changedFiles: 112 },
  Jordan:   { prs: 6,  additions: 890,  deletions: 340,  changedFiles: 28 },
  Alex:     { prs: 10, additions: 3450, deletions: 1230, changedFiles: 55 },
}

// ── Real data fetcher ────────────────────────────────────────────────────────

const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

async function ghFetch(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` },
    next: { revalidate: 120 },
  })
  if (!res.ok) return null
  return res.json()
}

function resolveReviewState(reviews: any[], requested: any[]): ReviewState {
  const latest: Record<string, string> = {}
  for (const r of reviews ?? []) {
    if (r.state !== 'COMMENTED') latest[r.user.login] = r.state
  }
  const states = Object.values(latest)
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested'
  if (states.includes('APPROVED')) return 'approved'
  if (requested?.length > 0) return 'pending'
  return 'none'
}

function resolveCIStatus(checkData: any): CIStatus {
  const runs: any[] = checkData?.check_runs ?? []
  if (!runs.length) return 'none'
  const conclusions = runs.map(r => r.conclusion ?? r.status)
  if (conclusions.some(c => c === 'failure' || c === 'timed_out' || c === 'cancelled')) return 'failure'
  if (conclusions.some(c => c === 'in_progress' || c === 'queued')) return 'pending'
  if (conclusions.every(c => c === 'success' || c === 'skipped' || c === 'neutral')) return 'success'
  return 'pending'
}

function weekLabel(iso: string): string {
  const d = new Date(iso)
  const s = new Date(d)
  s.setDate(d.getDate() - d.getDay())
  return s.toISOString().slice(0, 10)
}

async function fetchRealData(token: string, reposEnv: string): Promise<GithubData> {
  const repos = reposEnv.split(',').map(r => r.trim()).filter(Boolean)
  const STALE_DAYS = 3

  const allPRs = (await Promise.all(repos.map(async repo => {
    const [owner, name] = repo.split('/')
    const prs = await ghFetch(`/repos/${owner}/${name}/pulls?state=open&per_page=50`, token)
    if (!prs) return []
    return Promise.all(prs.map(async (pr: any) => {
      const [reviews, detail, checkData] = await Promise.all([
        ghFetch(`/repos/${owner}/${name}/pulls/${pr.number}/reviews`, token),
        ghFetch(`/repos/${owner}/${name}/pulls/${pr.number}`, token),
        ghFetch(`/repos/${owner}/${name}/commits/${pr.head.sha}/check-runs?per_page=50`, token),
      ])
      const daysSinceUpdate = (Date.now() - new Date(pr.updated_at).getTime()) / 86400000
      return {
        id: pr.id, number: pr.number, title: pr.title,
        author: pr.user.login, repo, repoName: name,
        url: pr.html_url, updatedAt: pr.updated_at, draft: pr.draft,
        reviewState: resolveReviewState(reviews ?? [], pr.requested_reviewers),
        ciStatus: resolveCIStatus(checkData),
        stale: !pr.draft && daysSinceUpdate > STALE_DAYS,
        additions: detail?.additions ?? 0, deletions: detail?.deletions ?? 0,
        changedFiles: detail?.changed_files ?? 0,
        comments: (pr.comments ?? 0) + (pr.review_comments ?? 0),
      } as GithubPR
    }))
  }))).flat()

  // Lines changed per week from open PRs (approximation — real impl would use merged PRs)
  const weekMap: Record<string, Record<string, number>> = {}
  for (const pr of allPRs) {
    const wk = weekLabel(pr.updatedAt)
    weekMap[wk] ??= {}
    weekMap[wk][pr.author] = (weekMap[wk][pr.author] ?? 0) + pr.additions + pr.deletions
  }
  const linesPerWeek = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pp]) => ({ date, ...pp }))

  // Member stats from open PRs
  const memberStats: Record<string, MemberGithubStats> = {}
  for (const pr of allPRs) {
    memberStats[pr.author] ??= { prs: 0, additions: 0, deletions: 0, changedFiles: 0 }
    memberStats[pr.author].prs++
    memberStats[pr.author].additions += pr.additions
    memberStats[pr.author].deletions += pr.deletions
    memberStats[pr.author].changedFiles += pr.changedFiles
  }

  return {
    recentPRs: allPRs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    linesPerWeek: linesPerWeek.length > 0 ? linesPerWeek : MOCK_LINES_PER_WEEK,
    memberStats: Object.keys(memberStats).length > 0 ? memberStats : MOCK_MEMBER_STATS,
    connected: true,
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function getGithubData(token?: string | null, repos?: string | null): Promise<GithubData> {
  if (token && repos) {
    try { return await fetchRealData(token, repos) } catch { /* fall through to mock */ }
  }
  return {
    recentPRs: MOCK_PRS,
    linesPerWeek: MOCK_LINES_PER_WEEK,
    memberStats: MOCK_MEMBER_STATS,
    connected: false,
  }
}
