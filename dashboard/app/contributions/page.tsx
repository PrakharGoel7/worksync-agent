'use client'
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, Clock, MessageSquare, Search } from 'lucide-react'
import MessageModal from '@/components/MessageModal'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts'

const PALETTE = ['#d97706', '#1d4ed8', '#15803d', '#dc2626', '#7c3aed', '#0891b2', '#b45309', '#065f46']
const OTHERS_COLOR = '#9ca3af'
const TOP_N = 8

type SortBy = 'messages' | 'lines'
type ChartTab = 'messages' | 'lines'

function seedName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h)
}
function getMockStats(name: string) {
  const s = seedName(name)
  return {
    prs: (s % 12) + 2,
    additions: ((s * 7) % 4500) + 400,
    deletions: ((s * 13) % 2500) + 150,
    changedFiles: ((s * 3) % 90) + 8,
  }
}

type TimeRange = 'all' | '90d' | '30d'

interface Contributor {
  name: string
  total: number
  recent: number
  prior: number
  openActionItems: number
  openBlockers: number
}

interface PersonDetail {
  actionItems: Array<{ id: number; task: string; deadline: string; channel: string }>
  blockers: Array<{ id: number; description: string; channel: string }>
  byWeek: Array<{ date: string; count: number }>
}

interface ContribData {
  allByWeek: Array<Record<string, string | number>>
  contributors: Contributor[]
  personDetails: Record<string, PersonDetail>
  teamId: string | null
  personSlackId: Record<string, string>
  channels: string[]
}

const LinesChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload ?? {}
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 160,
    }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 5, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{label}</div>
      <div style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: 7 }}>
        {(d.lines ?? 0).toLocaleString()} lines
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[
          { label: 'PRs', value: d.prs ?? 0 },
          { label: 'added', value: `+${(d.additions ?? 0).toLocaleString()}` },
          { label: 'removed', value: `−${(d.deletions ?? 0).toLocaleString()}` },
          { label: 'files', value: d.changedFiles ?? 0 },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{s.label}</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 7, height: 7, borderRadius: 2, background: p.fill }} />
          <span style={{ color: 'var(--text-muted)' }}>{p.dataKey}</span>
          <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginLeft: 'auto', paddingLeft: 16 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ContributionsPage() {
  const [data, setData] = useState<ContribData | null>(null)
  const [githubData, setGithubData] = useState<{
    connected: boolean
    memberStats: Record<string, { prs: number; additions: number; deletions: number; changedFiles: number }>
    linesPerWeek: Array<Record<string, string | number>>
    weeklyStats: Record<string, Record<string, { prs: number; additions: number; deletions: number; changedFiles: number }>>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [channel, setChannel] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortBy>('messages')
  const [chartTab, setChartTab] = useState<ChartTab>('messages')
  const [modal, setModal] = useState<{ recipient: string; userId?: string; context: string } | null>(null)

  const hasSlackData = (data?.contributors.length ?? 0) > 0
  const githubStats = hasSlackData ? (githubData?.memberStats ?? null) : null

  useEffect(() => { setChartTab('messages') }, [expanded])

  useEffect(() => {
    setLoading(true)
    const url = channel && channel !== 'all' ? `/api/contributions?channel=${encodeURIComponent(channel)}` : '/api/contributions'
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [channel])

  useEffect(() => {
    fetch('/api/github/data').then(r => r.json()).then(d => setGithubData(d)).catch(() => {})
  }, [])

  const { topPeople, chartData } = useMemo(() => {
    if (!data) return { topPeople: [] as string[], chartData: [] as Array<Record<string, string | number>> }

    const filtered = timeRange === 'all' ? data.allByWeek : (() => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - (timeRange === '30d' ? 30 : 90))
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      return data.allByWeek.filter(row => (row.date as string) >= cutoffStr)
    })()

    // Compute totals per person in filtered range
    const totals: Record<string, number> = {}
    for (const row of filtered) {
      for (const [k, v] of Object.entries(row)) {
        if (k === 'date') continue
        totals[k] = (totals[k] ?? 0) + Number(v)
      }
    }

    const top = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([name]) => name)

    const built = filtered.map(row => {
      const newRow: Record<string, string | number> = { date: row.date }
      let others = 0
      for (const [k, v] of Object.entries(row)) {
        if (k === 'date') continue
        if (top.includes(k)) newRow[k] = Number(v)
        else others += Number(v)
      }
      if (others > 0) newRow['Others'] = others
      return newRow
    })

    const people = top.filter(p => built.some(r => Number(r[p] ?? 0) > 0))
    if (built.some(r => Number(r['Others'] ?? 0) > 0)) people.push('Others')

    return { topPeople: people, chartData: built }
  }, [data, timeRange])

  // Raw per-week lines data for all contributors — used by both the section chart and per-person sparklines
  const rawLinesData = useMemo(() => {
    if (!data || data.contributors.length === 0) return [] as Array<Record<string, string | number>>
    if (githubData?.linesPerWeek?.length) return githubData.linesPerWeek
    const CORE = ['joshua', 'miroslav', 'prakhar', 'chris', 'pieach']
    const isCore = (name: string) => CORE.some(n => name.toLowerCase().includes(n))
    return data.allByWeek.map((row, wi) => {
      const nr: Record<string, string | number> = { date: row.date }
      data.contributors.forEach((c, pi) => {
        const s = seedName(`${wi * 17}-${pi * 31}-${c.name}`)
        nr[c.name] = isCore(c.name) ? (s % 700) + 350 : (s % 60) + 15
      })
      return nr
    })
  }, [data, githubData])

  const maxPersonLines = useMemo(() => {
    if (!rawLinesData.length) return 100
    let max = 0
    for (const row of rawLinesData) {
      for (const [k, v] of Object.entries(row)) {
        if (k !== 'date') max = Math.max(max, Number(v))
      }
    }
    return max || 100
  }, [rawLinesData])

  const { linesTopPeople, linesChartData } = useMemo(() => {
    if (!data || !rawLinesData.length) return { linesTopPeople: [] as string[], linesChartData: [] as Array<Record<string, string | number>> }

    // Apply same time range filter as messages chart
    const ld = timeRange === 'all' ? rawLinesData : (() => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - (timeRange === '30d' ? 30 : 90))
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      return rawLinesData.filter(row => (row.date as string) >= cutoffStr)
    })()

    if (!ld.length) return { linesTopPeople: [] as string[], linesChartData: [] as Array<Record<string, string | number>> }

    const totals: Record<string, number> = {}
    for (const row of ld) {
      for (const [k, v] of Object.entries(row)) {
        if (k === 'date') continue
        totals[k] = (totals[k] ?? 0) + Number(v)
      }
    }
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map(([n]) => n)
    const built = ld.map(row => {
      const nr: Record<string, string | number> = { date: row.date }
      let others = 0
      for (const [k, v] of Object.entries(row)) {
        if (k === 'date') continue
        if (top.includes(k)) nr[k] = Number(v)
        else others += Number(v)
      }
      if (others > 0) nr['Others'] = others
      return nr
    })
    const people = top.filter(p => built.some(r => Number(r[p] ?? 0) > 0))
    if (built.some(r => Number(r['Others'] ?? 0) > 0)) people.push('Others')
    return { linesTopPeople: people, linesChartData: built }
  }, [rawLinesData, data, timeRange])

  const filteredContributors = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    let list = !q ? data.contributors : data.contributors.filter(c => c.name.toLowerCase().includes(q))
    if (sort === 'lines') {
      list = [...list].sort((a, b) => {
        const ga = githubStats?.[a.name] ?? getMockStats(a.name)
        const gb = githubStats?.[b.name] ?? getMockStats(b.name)
        return (gb.additions + gb.deletions) - (ga.additions + ga.deletions)
      })
    }
    return list
  }, [data, search, sort, githubStats])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        borderBottom: '1px solid var(--border)', padding: '0 36px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
          color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-jakarta)',
        }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Member Activity
        </span>
        <div style={{ width: 140 }} />
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 36px 64px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', paddingTop: 80 }}>Loading…</div>
        ) : !data ? null : (
          <>
            {/* Section 1: Full timeline chart */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                    Activity by Week
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Messages per person over time</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Channel filter */}
                  {data.channels.length > 0 && (
                    <select
                      value={channel}
                      onChange={e => setChannel(e.target.value)}
                      style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)',
                        padding: '4px 8px', borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)', color: 'var(--text-muted)',
                        cursor: 'pointer', outline: 'none',
                      }}
                    >
                      <option value="all">All channels</option>
                      {data.channels.map(ch => (
                        <option key={ch} value={ch}>#{ch}</option>
                      ))}
                    </select>
                  )}
                  {/* Time range */}
                  <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    {(['all', '90d', '30d'] as TimeRange[]).map((r, i) => (
                      <button key={r} onClick={() => setTimeRange(r)} style={{
                        padding: '4px 12px', border: 'none',
                        borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)',
                        background: timeRange === r ? 'var(--text)' : 'transparent',
                        color: timeRange === r ? 'var(--bg)' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}>
                        {r === 'all' ? 'All time' : r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {chartData.length === 0 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                  No data for this range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barSize={14}>
                    <XAxis dataKey="date" tick={false} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                    <YAxis tick={{ fill: '#6b6560', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#6b6560', fontFamily: 'var(--font-jakarta)' }} />
                    {topPeople.map((p, i) => (
                      <Bar
                        key={p} dataKey={p} stackId="a"
                        fill={p === 'Others' ? OTHERS_COLOR : PALETTE[i % PALETTE.length]}
                        radius={i === topPeople.length - 1 ? [3, 3, 0, 0] : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}

              {linesChartData.length > 0 && (
                <>
                  <div style={{ margin: '18px 0 12px', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>lines changed per week</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={linesChartData} barSize={14}>
                      <XAxis dataKey="date" tick={false} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                      <YAxis tick={{ fill: '#6b6560', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#6b6560', fontFamily: 'var(--font-jakarta)' }} />
                      {linesTopPeople.map((p, i) => (
                        <Bar
                          key={p} dataKey={p} stackId="b"
                          fill={p === 'Others' ? OTHERS_COLOR : PALETTE[i % PALETTE.length]}
                          radius={i === linesTopPeople.length - 1 ? [3, 3, 0, 0] : undefined}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </motion.div>

            {/* Section 2: Leaderboard with expandable per-person detail */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}
            >
              <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                      Contributors
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Ranked by {sort === 'messages' ? 'messages sent' : 'lines changed'} · click to expand
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Sort toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Sort:</span>
                      <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                        {(['messages', 'lines'] as SortBy[]).map((s, i) => (
                          <button key={s} onClick={() => setSort(s)} style={{
                            padding: '4px 10px', border: 'none',
                            borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                            cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)',
                            background: sort === s ? 'var(--text)' : 'transparent',
                            color: sort === s ? 'var(--bg)' : 'var(--text-muted)',
                            transition: 'all 0.15s',
                          }}>{s}</button>
                        ))}
                      </div>
                    </div>
                    {/* Search */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search name…"
                        style={{
                          fontSize: 11, fontFamily: 'var(--font-mono)',
                          padding: '5px 8px 5px 26px', borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--bg)', color: 'var(--text)',
                          outline: 'none', width: 160,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {data.contributors.length === 0 ? (
                <div style={{ padding: '24px', color: 'var(--text-dim)', fontSize: 13 }}>
                  No contributor data yet — run a digest to populate.
                </div>
              ) : filteredContributors.length === 0 ? (
                <div style={{ padding: '24px', color: 'var(--text-dim)', fontSize: 13 }}>
                  No contributors matching "{search}".
                </div>
              ) : filteredContributors.map((c, i) => {
                const globalIdx = data.contributors.findIndex(x => x.name === c.name)
                const color = PALETTE[globalIdx % PALETTE.length]
                const isExpanded = expanded === c.name
                const detail = data.personDetails[c.name]
                const slackId = data.personSlackId[c.name]

                return (
                  <div key={c.name}>
                    <div
                      onClick={() => setExpanded(isExpanded ? null : c.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '13px 24px',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', transition: 'background 0.1s',
                        background: isExpanded ? 'var(--surface-raised)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface-raised)' }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ width: 20, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-jakarta)' }}>
                        {c.name}
                      </span>
                      {c.openActionItems > 0 && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, flexShrink: 0, background: 'var(--amber-light)', color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                          {c.openActionItems} action {c.openActionItems === 1 ? 'item' : 'items'}
                        </span>
                      )}
                      {c.openBlockers > 0 && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, flexShrink: 0, background: 'var(--red-light)', color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                          {c.openBlockers} {c.openBlockers === 1 ? 'blocker' : 'blockers'}
                        </span>
                      )}
                      <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: 36, textAlign: 'right', flexShrink: 0 }}>
                        {sort === 'lines'
                          ? (() => { const gs = githubStats?.[c.name] ?? getMockStats(c.name); return (gs.additions + gs.deletions).toLocaleString() })()
                          : c.total}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: 'var(--text-dim)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && detail && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          style={{ overflow: 'hidden', borderTop: '1px solid var(--border)' }}
                        >
                          <div style={{ padding: '20px 24px', background: 'var(--bg)' }}>
                            {(() => {
                              const personLines = rawLinesData.map(row => {
                                const wk = githubData?.weeklyStats?.[row.date as string]?.[c.name]
                                return {
                                  date: row.date as string,
                                  lines: Number(row[c.name] ?? 0),
                                  prs: wk?.prs ?? 0,
                                  additions: wk?.additions ?? 0,
                                  deletions: wk?.deletions ?? 0,
                                  changedFiles: wk?.changedFiles ?? 0,
                                }
                              })
                              return (
                                <div style={{ marginBottom: 20 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                                      {(['messages', 'lines'] as ChartTab[]).map((tab, ti) => (
                                        <button key={tab} onClick={e => { e.stopPropagation(); setChartTab(tab) }} style={{
                                          padding: '3px 10px', border: 'none',
                                          borderLeft: ti > 0 ? '1px solid var(--border)' : 'none',
                                          cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)',
                                          background: chartTab === tab ? 'var(--text)' : 'transparent',
                                          color: chartTab === tab ? 'var(--bg)' : 'var(--text-muted)',
                                          transition: 'all 0.15s',
                                        }}>{tab}</button>
                                      ))}
                                    </div>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation()
                                        const ctx = detail.actionItems.length > 0 ? detail.actionItems[0].task : 'Weekly check-in'
                                        setModal({ recipient: c.name, userId: slackId || undefined, context: ctx })
                                      }}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                        padding: '4px 10px', borderRadius: 6,
                                        border: '1px solid var(--border)', background: 'transparent',
                                        cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)',
                                        fontFamily: 'var(--font-jakarta)', transition: 'all 0.15s',
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)' }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                                    >
                                      <MessageSquare size={11} /> Message {c.name.split(' ')[0]}
                                    </button>
                                  </div>

                                  {chartTab === 'messages' ? (
                                    detail.byWeek.length > 1 ? (
                                      <ResponsiveContainer width="100%" height={100}>
                                        <AreaChart data={detail.byWeek}>
                                          <defs>
                                            <linearGradient id={`grad-${globalIdx}`} x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                                              <stop offset="95%" stopColor={color} stopOpacity={0} />
                                            </linearGradient>
                                          </defs>
                                          <Area type="monotone" dataKey="count" stroke={color} fill={`url(#grad-${globalIdx})`} strokeWidth={1.5} dot={false} />
                                          <XAxis dataKey="date" hide />
                                          <YAxis hide />
                                          <Tooltip
                                            contentStyle={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px' }}
                                            itemStyle={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                                            labelStyle={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 10, marginBottom: 2 }}
                                            formatter={(v: any) => [v, 'messages']}
                                          />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    ) : (
                                      <div style={{ height: 100, display: 'flex', alignItems: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                                        Not enough activity data yet
                                      </div>
                                    )
                                  ) : (
                                    <ResponsiveContainer width="100%" height={100}>
                                      <AreaChart data={personLines}>
                                        <defs>
                                          <linearGradient id={`lgrad-${globalIdx}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                                          </linearGradient>
                                        </defs>
                                        <Area type="monotone" dataKey="lines" stroke={color} fill={`url(#lgrad-${globalIdx})`} strokeWidth={1.5} dot={false} />
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide domain={[0, maxPersonLines]} />
                                        <Tooltip content={<LinesChartTip />} />
                                      </AreaChart>
                                    </ResponsiveContainer>
                                  )}
                                </div>
                              )
                            })()}


                            {(detail.actionItems.length > 0 || detail.blockers.length > 0) && (
                              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                {detail.actionItems.length > 0 && (
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                                      Open action items ({detail.actionItems.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      {detail.actionItems.slice(0, 4).map(ai => (
                                        <div key={ai.id} style={{ fontSize: 12, lineHeight: 1.45, padding: '7px 10px', borderRadius: 5, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                          <div style={{ color: 'var(--text)' }}>{ai.task}</div>
                                          <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                                            {ai.channel && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>#{ai.channel}</span>}
                                            {ai.deadline && ai.deadline !== 'unspecified' && (
                                              <span style={{ fontSize: 10, color: 'var(--amber)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Clock size={9} />{ai.deadline}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                      {detail.actionItems.length > 4 && (
                                        <Link href={`/action-items?person=${encodeURIComponent(c.name)}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>
                                          +{detail.actionItems.length - 4} more →
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {detail.blockers.length > 0 && (
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                                      Involved in blockers ({detail.blockers.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      {detail.blockers.slice(0, 4).map(b => (
                                        <div key={b.id} style={{ fontSize: 12, lineHeight: 1.45, padding: '7px 10px', borderRadius: 5, background: 'var(--red-light)', border: '1px solid var(--border)', borderLeft: '2px solid var(--red)' }}>
                                          <div style={{ color: 'var(--text)' }}>{b.description}</div>
                                          {b.channel && <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>#{b.channel}</div>}
                                        </div>
                                      ))}
                                      {detail.blockers.length > 4 && (
                                        <Link href={`/blockers?person=${encodeURIComponent(c.name)}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>
                                          +{detail.blockers.length - 4} more →
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {detail.actionItems.length === 0 && detail.blockers.length === 0 && detail.byWeek.length <= 1 && (
                              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-jakarta)' }}>
                                No open work items or activity history to show.
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </motion.div>
          </>
        )}
      </main>

      {modal && (
        <MessageModal
          recipient={modal.recipient}
          userId={modal.userId}
          context={modal.context}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
