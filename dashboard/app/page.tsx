'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Header from '@/components/Header'
import ContributionChart from '@/components/ContributionChart'
import ActionItemsTable from '@/components/ActionItemsTable'
import BlockersFeed from '@/components/BlockersFeed'
import DecisionsLog from '@/components/DecisionsLog'
import RecentPRsFeed from '@/components/RecentPRsFeed'
import type { GithubData } from '@/lib/github'

export interface DashboardData {
  stats: {
    totalMessages: number
    openActionItems: number
    activeBlockers: number
    activeContributors: number
    totalDigests: number
  }
  periodSummary: string[] | null
  actionItems: ActionItem[]
  actionItemOwners: string[]
  blockers: Blocker[]
  decisions: Decision[]
  contributionsByDigest: Array<Record<string, string | number>>
  channels: string[]
}

export interface ActionItem {
  id: number
  owner: string
  task: string
  deadline: string
  channel: string
  status: string
  createdAt: string
}

export interface Blocker {
  id: number
  description: string
  affected: string
  channel: string
  createdAt: string
  status: string
}

export interface Decision {
  id: number
  decision: string
  channel: string
  createdAt: string
  read: number
}

export default function Dashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [channel, setChannel] = useState<string>('all')
  const [githubData, setGithubData] = useState<GithubData | null>(null)

  useEffect(() => {
    fetch('/api/workspace').then(r => r.json()).then(d => {
      if (!d.channels?.length || !d.managerSlackId) {
        router.replace('/onboarding')
      }
    }).catch(() => {})
  }, [])

  const fetchData = useCallback(async (ch?: string) => {
    setLoading(true)
    try {
      const url = ch && ch !== 'all' ? `/api/dashboard?channel=${encodeURIComponent(ch)}` : '/api/dashboard'
      const res = await fetch(url, { cache: 'no-store' })
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const runDigest = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/run', { method: 'POST' })
      if (res.status === 409) {
        alert('A digest is already running — check back in a minute.')
        return
      }
      await fetchData(channel)
    } finally {
      setRunning(false)
    }
  }

  const toggleActionItem = async (id: number, current: string) => {
    const next = current === 'done' ? 'open' : 'done'
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setData(prev => prev ? {
      ...prev,
      actionItems: prev.actionItems.map(i => i.id === id ? { ...i, status: next } : i),
      stats: {
        ...prev.stats,
        openActionItems: next === 'done'
          ? prev.stats.openActionItems - 1
          : prev.stats.openActionItems + 1,
      },
    } : prev)
  }

  useEffect(() => { fetchData(channel) }, [fetchData, channel])

  useEffect(() => {
    fetch('/api/github/data').then(r => r.json()).then(setGithubData).catch(() => {})
  }, [])

  const channels = data?.channels ?? []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header onRun={runDigest} running={running} />
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 36px 64px' }}>
        {loading ? <Skeleton /> : !data ? <Empty /> : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Period summary */}
            {data.periodSummary && data.periodSummary.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{ marginTop: 16, position: 'relative' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Snapshot</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>from the latest digest</span>
                </div>
                <div style={{
                  display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2,
                  scrollbarWidth: 'none',
                } as React.CSSProperties}>
                  {data.periodSummary.map((insight, i) => (
                    <div
                      key={i}
                      style={{
                        minWidth: 200, maxWidth: 240, flexShrink: 0,
                        padding: '11px 15px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {insight}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Channel filter strip */}
            <div style={{ marginTop: 16 }}>
              {channels.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  No channel data yet — run a digest to populate.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Channel:</span>
                  <button
                    onClick={() => setChannel('all')}
                    style={{
                      padding: '3px 10px', borderRadius: 10, fontSize: 11,
                      fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s',
                      border: `1px solid ${channel === 'all' ? 'var(--text)' : 'var(--border)'}`,
                      background: channel === 'all' ? 'var(--text)' : 'transparent',
                      color: channel === 'all' ? 'var(--bg)' : 'var(--text-muted)',
                    }}
                  >All</button>
                  {channels.map(ch => (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      style={{
                        padding: '3px 10px', borderRadius: 10, fontSize: 11,
                        fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s',
                        border: `1px solid ${channel === ch ? 'var(--text)' : 'var(--border)'}`,
                        background: channel === ch ? 'var(--text)' : 'transparent',
                        color: channel === ch ? 'var(--bg)' : 'var(--text-muted)',
                      }}
                    >#{ch}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Two-column layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 420px',
              gap: 16,
              marginTop: 16,
              alignItems: 'start',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <BlockersFeed blockers={data.blockers} />
                {githubData && (
                  <RecentPRsFeed prs={githubData.recentPRs} connected={githubData.connected} />
                )}
                <ActionItemsTable
                  items={data.actionItems}
                  owners={data.actionItemOwners ?? []}
                  onToggle={toggleActionItem}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ContributionChart
                  data={data.contributionsByDigest}
                  linesData={githubData?.linesPerWeek}
                />
                <DecisionsLog decisions={data.decisions} />
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{
          height: 120, borderRadius: 8,
          background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-raised) 50%, var(--surface) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.8s infinite',
          border: '1px solid var(--border)',
        }} />
      ))}
    </div>
  )
}

function Empty() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 15, marginBottom: 8, fontFamily: 'var(--font-serif)' }}>No digest data yet</div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Click "Run Digest" to fetch and analyze your Slack channels</div>
    </div>
  )
}
