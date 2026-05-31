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

export interface WeekPersonStats {
  prs: number
  additions: number
  deletions: number
  changedFiles: number
}

export interface GithubData {
  recentPRs: GithubPR[]
  linesPerWeek: Array<Record<string, string | number>>
  memberStats: Record<string, MemberGithubStats>
  weeklyStats: Record<string, Record<string, WeekPersonStats>>
  connected: boolean
}

// ── Unified mock data ─────────────────────────────────────────────────────────
// Single source of truth: generates mock PRs across numWeeks weeks, then derives
// linesPerWeek and memberStats from those same PRs so everything is consistent.

function h(str: string): number {
  let v = 0
  for (let i = 0; i < str.length; i++) v = (v * 31 + str.charCodeAt(i)) | 0
  return Math.abs(v)
}

const PR_TITLES = [
  'Refactor authentication middleware to support OAuth2',
  'Fix race condition in message queue processor',
  'Add rate limiting to public API endpoints',
  'Implement real-time notifications via WebSocket',
  'Optimise database query planner for large datasets',
  'Migrate CI pipeline to GitHub Actions',
  'Update payment processor to Stripe v3',
  'Add Jest unit tests for core utilities',
  'Rebuild onboarding flow with step-by-step wizard',
  'Fix broken layout on mobile viewports below 375px',
  'Add Terraform modules for staging environment',
  'Integrate analytics SDK and add event tracking',
  'Implement OAuth2 for third-party integrations',
  'Refactor database connection pooling',
  'A/B test framework for feature flag experiments',
  'Bump dependency versions across monorepo',
  'Add end-to-end tests for checkout flow',
  'Improve error handling and structured logging',
  'Implement CSV data export functionality',
  'Add Elasticsearch indexing pipeline',
]
const REPOS = ['acme/api', 'acme/web', 'acme/infra']
const REVIEWS: ReviewState[] = ['approved', 'approved', 'pending', 'changes_requested', 'none']
const CI_STATUSES: CIStatus[] = ['success', 'success', 'success', 'failure', 'pending']

export function generateUnifiedMockData(names: string[], numWeeks = 80): {
  openPRs: GithubPR[]
  linesPerWeek: Array<Record<string, string | number>>
  memberStats: Record<string, MemberGithubStats>
  weeklyStats: Record<string, Record<string, WeekPersonStats>>
} {
  if (!names.length) names = ['Alice']

  const CORE_N = Math.min(5, names.length)
  // Core contributors appear 4x in the weighted pool → get ~4x more PRs
  const pool = [
    ...names.slice(0, CORE_N).flatMap(n => [n, n, n, n]),
    ...names.slice(CORE_N),
  ]

  const memberStats: Record<string, MemberGithubStats> = {}
  names.forEach(n => { memberStats[n] = { prs: 0, additions: 0, deletions: 0, changedFiles: 0 } })

  const linesPerWeek: Array<Record<string, string | number>> = []
  const weeklyStats: Record<string, Record<string, WeekPersonStats>> = {}
  const openPRs: GithubPR[] = []
  let prNumber = 200 + numWeeks * 6
  let prId = 1

  // Iterate oldest → newest (wi=numWeeks-1 is oldest, wi=0 is this week)
  for (let wi = numWeeks - 1; wi >= 0; wi--) {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - wi * 7)
    const weekDate = weekStart.toISOString().slice(0, 10)

    const row: Record<string, string | number> = { date: weekDate }
    names.forEach(n => { row[n] = 0 })
    weeklyStats[weekDate] = {}

    const prsThisWeek = 3 + (h(`${wi}-n`) % 4) // 3–6 per week

    for (let pi = 0; pi < prsThisWeek; pi++) {
      const author = pool[h(`${wi}-${pi}-a`) % pool.length]
      const isCore = names.indexOf(author) < CORE_N
      const seed   = h(`${wi}-${pi}-${author}`)

      const additions    = isCore ? (seed % 800) + 200 : (seed % 120) + 25
      const deletions    = isCore ? (h(`${wi}-${pi}-del`) % 400) + 50 : (h(`${wi}-${pi}-del`) % 60) + 8
      const changedFiles = isCore ? (seed % 16) + 4 : (seed % 4) + 1
      const comments     = h(`${wi}-${pi}-c`) % 12

      const repo      = REPOS[h(`${wi}-${pi}-r`) % REPOS.length]
      const title     = PR_TITLES[h(`${wi}-${pi}-t`) % PR_TITLES.length]
      const dayOffset = h(`${wi}-${pi}-d`) % 5
      const updatedAt = new Date(weekStart.getTime() + dayOffset * 86400000).toISOString()

      const reviewState = REVIEWS[h(`${wi}-${pi}-rv`) % REVIEWS.length]
      const ciStatus    = CI_STATUSES[h(`${wi}-${pi}-ci`) % CI_STATUSES.length]
      const isRecentWeek = wi <= 2
      const stale = isRecentWeek && dayOffset >= 4 && h(`${wi}-${pi}-st`) % 3 === 0

      const pr: GithubPR = {
        id: prId++, number: prNumber--,
        title, author, repo, repoName: repo.split('/')[1],
        url: '#', updatedAt, draft: false,
        reviewState, ciStatus, stale,
        additions, deletions, changedFiles, comments,
      }

      if (isRecentWeek) openPRs.push(pr)

      row[author] = (row[author] as number) + additions + deletions

      const ws = weeklyStats[weekDate]
      ws[author] ??= { prs: 0, additions: 0, deletions: 0, changedFiles: 0 }
      ws[author].prs++
      ws[author].additions += additions
      ws[author].deletions += deletions
      ws[author].changedFiles += changedFiles

      memberStats[author].prs++
      memberStats[author].additions += additions
      memberStats[author].deletions += deletions
      memberStats[author].changedFiles += changedFiles
    }

    linesPerWeek.push(row)
  }

  return {
    openPRs: openPRs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    linesPerWeek, // already oldest → newest
    memberStats,
    weeklyStats,
  }
}

// ── Real data fetcher ─────────────────────────────────────────────────────────

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

  const weekMap: Record<string, Record<string, number>> = {}
  const weeklyStats: Record<string, Record<string, WeekPersonStats>> = {}
  for (const pr of allPRs) {
    const wk = weekLabel(pr.updatedAt)
    weekMap[wk] ??= {}
    weekMap[wk][pr.author] = (weekMap[wk][pr.author] ?? 0) + pr.additions + pr.deletions
    weeklyStats[wk] ??= {}
    weeklyStats[wk][pr.author] ??= { prs: 0, additions: 0, deletions: 0, changedFiles: 0 }
    weeklyStats[wk][pr.author].prs++
    weeklyStats[wk][pr.author].additions += pr.additions
    weeklyStats[wk][pr.author].deletions += pr.deletions
    weeklyStats[wk][pr.author].changedFiles += pr.changedFiles
  }
  const linesPerWeek = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pp]) => ({ date, ...pp }))

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
    linesPerWeek,
    memberStats,
    weeklyStats,
    connected: true,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getGithubData(
  token?: string | null,
  repos?: string | null,
  contributorNames: string[] = [],
): Promise<GithubData> {
  if (token && repos) {
    try { return await fetchRealData(token, repos) } catch { /* fall through */ }
  }
  const { openPRs, linesPerWeek, memberStats, weeklyStats } = generateUnifiedMockData(
    contributorNames.length ? contributorNames : ['Miroslav', 'Prakhar', 'Joshua', 'Chris', 'Pieach', 'Sarah', 'Jordan']
  )
  return {
    recentPRs: openPRs.slice(0, 5),
    linesPerWeek,
    memberStats,
    weeklyStats,
    connected: false,
  }
}
