'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, GitPullRequest, MessageSquare, Clock, ExternalLink, CheckCircle2, XCircle, Loader, FileCode } from 'lucide-react'

type CIStatus = 'success' | 'failure' | 'pending' | 'none'

interface PR {
  id: number
  number: number
  title: string
  author: string
  authorAvatar: string
  repo: string
  repoName: string
  url: string
  createdAt: string
  updatedAt: string
  draft: boolean
  reviewState: 'approved' | 'changes_requested' | 'pending' | 'none'
  ciStatus: CIStatus
  requestedReviewers: string[]
  stale: boolean
  daysSinceUpdate: number
  comments: number
  additions: number | null
  deletions: number | null
  changedFiles: number | null
  commits: number | null
}

type Group = 'changes_requested' | 'approved' | 'pending' | 'stale' | 'draft' | 'active'

const GROUP_META: Record<Group, { label: string; color: string; bg: string; order: number }> = {
  changes_requested: { label: 'Changes Requested', color: 'var(--red)',    bg: 'rgba(220,38,38,0.06)',  order: 0 },
  approved:          { label: 'Approved',           color: 'var(--green)',  bg: 'rgba(21,128,61,0.06)',  order: 1 },
  pending:           { label: 'Needs Review',       color: 'var(--amber)',  bg: 'rgba(217,119,6,0.06)', order: 2 },
  stale:             { label: 'Stale',              color: '#9ca3af',       bg: 'rgba(156,163,175,0.06)', order: 3 },
  active:            { label: 'In Progress',        color: 'var(--blue)',   bg: 'rgba(29,78,216,0.06)',  order: 4 },
  draft:             { label: 'Draft',              color: 'var(--text-dim)', bg: 'transparent',         order: 5 },
}

function prGroup(pr: PR): Group {
  if (pr.draft) return 'draft'
  if (pr.reviewState === 'changes_requested') return 'changes_requested'
  if (pr.reviewState === 'approved') return 'approved'
  if (pr.stale) return 'stale'
  if (pr.reviewState === 'pending') return 'pending'
  return 'active'
}

function CIBadge({ status }: { status: CIStatus }) {
  if (status === 'none') return null
  const map = {
    success: { icon: <CheckCircle2 size={12} />, color: 'var(--green)' },
    failure: { icon: <XCircle size={12} />,     color: 'var(--red)'   },
    pending: { icon: <Loader size={12} style={{ animation: 'spin 1.5s linear infinite' }} />, color: '#9ca3af' },
  }
  const { icon, color } = map[status]
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color, fontFamily: 'var(--font-mono)' }}>
      {icon} CI
    </span>
  )
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function GitHubPage() {
  const [prs, setPRs] = useState<PR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterRepo, setFilterRepo] = useState('all')

  useEffect(() => {
    fetch('/api/github/prs')
      .then(r => r.json())
      .then(d => {
        if (d.error === 'missing_config') {
          setError('config')
        } else {
          setPRs(d.prs ?? [])
        }
        setLoading(false)
      })
      .catch(() => { setError('fetch'); setLoading(false) })
  }, [])

  const repos = ['all', ...Array.from(new Set(prs.map(p => p.repo))).sort()]
  const shown = filterRepo === 'all' ? prs : prs.filter(p => p.repo === filterRepo)

  const grouped = Object.entries(
    shown.reduce<Record<Group, PR[]>>((acc, pr) => {
      const g = prGroup(pr)
      acc[g] ??= []
      acc[g].push(pr)
      return acc
    }, {} as Record<Group, PR[]>)
  ).sort(([a], [b]) => GROUP_META[a as Group].order - GROUP_META[b as Group].order)

  const openCount = shown.filter(p => !p.draft).length
  const staleCt = shown.filter(p => p.stale).length
  const needsReview = shown.filter(p => p.reviewState === 'pending').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        borderBottom: '1px solid var(--border)', padding: '0 36px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          textDecoration: 'none', color: 'var(--text-muted)', fontSize: 13,
          fontFamily: 'var(--font-jakarta)',
        }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Pull Requests
        </span>
        <div style={{ width: 140 }} />
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 36px 64px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', paddingTop: 80 }}>Loading…</div>
        ) : error === 'config' ? (
          <ConfigPrompt />
        ) : error ? (
          <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)', fontSize: 13 }}>
            Failed to fetch pull requests.
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'open PRs', value: openCount, color: 'var(--text)' },
                { label: 'needs review', value: needsReview, color: 'var(--amber)' },
                { label: 'stale', value: staleCt, color: '#9ca3af' },
              ].map(s => (
                <div key={s.label} style={{
                  flex: 1, padding: '14px 18px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 8,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Repo filter */}
            {repos.length > 2 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Repo:</span>
                {repos.map(r => (
                  <button key={r} onClick={() => setFilterRepo(r)} style={{
                    padding: '3px 10px', borderRadius: 10, fontSize: 11,
                    fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s',
                    border: `1px solid ${filterRepo === r ? 'var(--text)' : 'var(--border)'}`,
                    background: filterRepo === r ? 'var(--text)' : 'transparent',
                    color: filterRepo === r ? 'var(--bg)' : 'var(--text-muted)',
                  }}>{r === 'all' ? 'All' : r}</button>
                ))}
              </div>
            )}

            {prs.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>
                No open pull requests
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {grouped.map(([group, items], gi) => {
                  const meta = GROUP_META[group as Group]
                  return (
                    <div key={group}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
                          color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>{meta.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {items.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {items.map((pr, i) => (
                          <motion.div
                            key={pr.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (gi * 4 + i) * 0.02, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                              padding: '13px 16px',
                              background: pr.draft ? 'transparent' : meta.bg,
                              border: '1px solid var(--border)',
                              borderLeft: `3px solid ${meta.color}`,
                              borderRadius: 8,
                              display: 'flex', alignItems: 'flex-start', gap: 12,
                            }}
                          >
                            <GitPullRequest size={15} style={{ color: meta.color, marginTop: 2, flexShrink: 0 }} />

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                <a
                                  href={pr.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: 13, color: 'var(--text)', fontWeight: 500,
                                    textDecoration: 'none', lineHeight: 1.4,
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--blue)')}
                                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
                                >
                                  {pr.title}
                                </a>
                                <a href={pr.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, color: 'var(--text-dim)', opacity: 0.5, transition: 'opacity 0.15s' }}
                                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                                >
                                  <ExternalLink size={12} />
                                </a>
                              </div>

                              <div style={{ display: 'flex', gap: 12, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                  #{pr.number}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                  {pr.author}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                  {pr.repoName}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                  <Clock size={9} /> {timeAgo(pr.updatedAt)}
                                </span>
                                {pr.additions !== null && (
                                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', display: 'flex', gap: 4 }}>
                                    <span style={{ color: 'var(--green)' }}>+{pr.additions}</span>
                                    <span style={{ color: 'var(--red)' }}>−{pr.deletions}</span>
                                  </span>
                                )}
                                {pr.changedFiles !== null && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                    <FileCode size={9} /> {pr.changedFiles} {pr.changedFiles === 1 ? 'file' : 'files'}
                                  </span>
                                )}
                                {pr.comments > 0 && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                    <MessageSquare size={9} /> {pr.comments}
                                  </span>
                                )}
                                <CIBadge status={pr.ciStatus} />
                                {pr.requestedReviewers.length > 0 && (
                                  <span style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                                    waiting on {pr.requestedReviewers.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function ConfigPrompt() {
  return (
    <div style={{
      maxWidth: 480, margin: '80px auto', padding: '32px 36px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
    }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
        Connect GitHub
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
        Add two environment variables to your Vercel project to enable GitHub PR tracking.
      </div>
      {[
        { key: 'GITHUB_TOKEN', desc: 'Personal access token with repo read access' },
        { key: 'GITHUB_REPOS', desc: 'Comma-separated list of owner/repo (e.g. acme/api,acme/web)' },
      ].map(v => (
        <div key={v.key} style={{ marginBottom: 14 }}>
          <code style={{
            display: 'block', fontSize: 12, fontFamily: 'var(--font-mono)',
            background: 'var(--surface-raised)', padding: '6px 10px', borderRadius: 5,
            color: 'var(--text)', marginBottom: 4,
          }}>
            {v.key}
          </code>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{v.desc}</div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 20, lineHeight: 1.6 }}>
        Generate a token at GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens. Grant read-only access to Contents and Pull requests.
      </div>
    </div>
  )
}
