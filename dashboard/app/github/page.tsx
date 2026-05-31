'use client'
import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, GitPullRequest, MessageSquare, Clock, ExternalLink, CheckCircle2, XCircle, Loader, FileCode, Search } from 'lucide-react'
import MessageModal from '@/components/MessageModal'

type CIStatus = 'success' | 'failure' | 'pending' | 'none'
type StatusFilter = 'all' | 'open' | 'review' | 'stale'
type DateRange = 'all' | 'week' | 'month' | 'custom'

interface PR {
  id: number
  number: number
  title: string
  author: string
  repo: string
  repoName: string
  url: string
  updatedAt: string
  draft: boolean
  reviewState: 'approved' | 'changes_requested' | 'pending' | 'none'
  ciStatus: CIStatus
  stale: boolean
  additions: number | null
  deletions: number | null
  changedFiles: number | null
  comments: number
}

const STATUS_META = {
  changes_requested: { color: 'var(--red)',      bg: 'rgba(220,38,38,0.06)',   label: 'Changes Requested' },
  approved:          { color: 'var(--green)',     bg: 'rgba(21,128,61,0.06)',   label: 'Approved'          },
  pending:           { color: 'var(--amber)',     bg: 'rgba(217,119,6,0.06)',   label: 'Needs Review'      },
  stale:             { color: '#9ca3af',          bg: 'rgba(156,163,175,0.06)', label: 'Stale'             },
  active:            { color: 'var(--blue)',      bg: 'rgba(29,78,216,0.06)',   label: 'In Progress'       },
  draft:             { color: 'var(--text-dim)',  bg: 'transparent',            label: 'Draft'             },
} as const
type PRStatus = keyof typeof STATUS_META

function prStatus(pr: PR): PRStatus {
  if (pr.draft) return 'draft'
  if (pr.reviewState === 'changes_requested') return 'changes_requested'
  if (pr.reviewState === 'approved') return 'approved'
  if (pr.stale) return 'stale'
  if (pr.reviewState === 'pending') return 'pending'
  return 'active'
}

function inDateRange(iso: string, range: DateRange, from: string, to: string): boolean {
  if (range === 'all') return true
  const d = new Date(iso)
  if (isNaN(d.getTime())) return true
  const now = Date.now()
  if (range === 'week')  return d.getTime() >= now - 7 * 86400_000
  if (range === 'month') return d.getTime() >= now - 30 * 86400_000
  if (range === 'custom') {
    if (from && d < new Date(from)) return false
    if (to   && d > new Date(to + 'T23:59:59')) return false
    return true
  }
  return true
}

function CIBadge({ status }: { status: CIStatus }) {
  if (status === 'none') return null
  const map = {
    success: { icon: <CheckCircle2 size={12} />, color: 'var(--green)' },
    failure: { icon: <XCircle size={12} />,      color: 'var(--red)'   },
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

function selectStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 10px', fontSize: 12, fontFamily: 'var(--font-mono)',
    border: '1px solid var(--border)', borderRadius: 6,
    background: active ? 'var(--amber-light)' : 'var(--surface)',
    color: active ? 'var(--amber)' : 'var(--text-muted)',
    cursor: 'pointer', outline: 'none',
  }
}

export default function GitHubPage() {
  const [prs, setPRs] = useState<PR[]>([])
  const [connected, setConnected] = useState(true)
  const [hasSlackData, setHasSlackData] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [person, setPerson] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [modal, setModal] = useState<{ recipient: string; context: string } | null>(null)

  useEffect(() => {
    fetch('/api/github/prs')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError('fetch')
        else { setPRs(d.prs ?? []); setConnected(d.connected ?? false); setHasSlackData(d.hasSlackData ?? true) }
        setLoading(false)
      })
      .catch(() => { setError('fetch'); setLoading(false) })
  }, [])

  const filteredPRs = useMemo(() => prs.filter(pr => {
    if (status === 'open'   && (pr.draft || pr.stale)) return false
    if (status === 'review' && pr.reviewState !== 'pending') return false
    if (status === 'stale'  && !pr.stale) return false
    if (person !== 'all'   && pr.author !== person) return false
    if (search.trim()      && !pr.title.toLowerCase().includes(search.toLowerCase())) return false
    if (!inDateRange(pr.updatedAt, dateRange, customFrom, customTo)) return false
    return true
  }), [prs, status, person, search, dateRange, customFrom, customTo])

  // People: unique authors from PRs (names already match Slack format from API)
  const people = useMemo(() => {
    const authors = [...new Set(prs.map(pr => pr.author))].sort()
    return ['all', ...authors]
  }, [prs])

  const openCount   = prs.filter(p => !p.draft).length
  const reviewCount = prs.filter(p => p.reviewState === 'pending').length
  const staleCount  = prs.filter(p => p.stale).length

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
        ) : error ? (
          <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)', fontSize: 13 }}>
            Failed to fetch pull requests.
          </div>
        ) : !hasSlackData ? (
          <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-jakarta)' }}>
            Run a digest first to see pull request data.
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'open PRs',    value: openCount,   color: 'var(--text)' },
                { label: 'needs review', value: reviewCount, color: 'var(--amber)' },
                { label: 'stale',       value: staleCount,  color: '#9ca3af' },
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

            {/* Filter row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search PRs…"
                  style={{
                    padding: '6px 10px 6px 28px', width: 180,
                    border: '1px solid var(--border)', borderRadius: 6,
                    background: 'var(--surface)', color: 'var(--text)',
                    fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {([
                  { value: 'all',    label: 'All'          },
                  { value: 'open',   label: 'Open'         },
                  { value: 'review', label: 'Needs Review' },
                  { value: 'stale',  label: 'Stale'        },
                ] as { value: StatusFilter; label: string }[]).map((f, i) => (
                  <button key={f.value} onClick={() => setStatus(f.value)} style={{
                    padding: '5px 12px', border: 'none',
                    borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)',
                    background: status === f.value ? 'var(--text)' : 'transparent',
                    color: status === f.value ? 'var(--bg)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>{f.label}</button>
                ))}
              </div>

              <select value={person} onChange={e => setPerson(e.target.value)} style={selectStyle(person !== 'all')}>
                <option value="all">All people</option>
                {people.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                {filteredPRs.length} of {prs.length}
              </span>
            </div>

            {/* Date filter row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              {([
                { label: 'All time',   value: 'all'    },
                { label: 'Last week',  value: 'week'   },
                { label: 'Last month', value: 'month'  },
                { label: 'Custom',     value: 'custom' },
              ] as { label: string; value: DateRange }[]).map(opt => (
                <button key={opt.value} onClick={() => setDateRange(opt.value)} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12,
                  border: `1px solid ${dateRange === opt.value ? 'var(--amber)' : 'var(--border)'}`,
                  background: dateRange === opt.value ? 'var(--amber-light)' : 'var(--surface)',
                  color: dateRange === opt.value ? 'var(--amber)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s',
                }}>{opt.label}</button>
              ))}
              {dateRange === 'custom' && (
                <>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', outline: 'none' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>→</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', outline: 'none' }} />
                </>
              )}
            </div>

            {filteredPRs.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>
                No pull requests match the current filters
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredPRs.map((pr, i) => {
                  const s = prStatus(pr)
                  const meta = STATUS_META[s]
                  const author = pr.author
                  return (
                    <motion.div
                      key={pr.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.018, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                            style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, textDecoration: 'none', lineHeight: 1.4 }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--blue)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
                          >
                            {pr.title}
                          </a>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{
                              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                              color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>{meta.label}</span>
                            <a href={pr.url} target="_blank" rel="noopener noreferrer"
                              style={{ color: 'var(--text-dim)', opacity: 0.5, transition: 'opacity 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>#{pr.number}</span>
                          <span style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{author}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{pr.repoName}</span>
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
                          <button
                            onClick={e => { e.stopPropagation(); setModal({ recipient: author, context: pr.title }) }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              marginLeft: 'auto', padding: '3px 8px', borderRadius: 5,
                              border: '1px solid var(--border)', background: 'transparent',
                              cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)',
                              fontFamily: 'var(--font-jakarta)', transition: 'all 0.15s', flexShrink: 0,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                          >
                            <MessageSquare size={10} /> Message {author.split(' ')[0]}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {modal && (
        <MessageModal
          recipient={modal.recipient}
          context={modal.context}
          onClose={() => setModal(null)}
        />
      )}
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
          }}>{v.key}</code>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{v.desc}</div>
        </div>
      ))}
    </div>
  )
}
