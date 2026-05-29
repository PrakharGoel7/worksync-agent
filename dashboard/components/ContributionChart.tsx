'use client'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const PALETTE = ['#d97706', '#1d4ed8', '#15803d', '#dc2626', '#7c3aed', '#0891b2', '#b45309', '#065f46']
const OTHERS_COLOR = '#9ca3af'
const TOP_N = 5

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '10px 14px', fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
          <span style={{ color: 'var(--text-muted)' }}>{p.dataKey}</span>
          <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginLeft: 'auto' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  data: Array<Record<string, string | number>>
  linesData?: Array<Record<string, string | number>>
}

export default function ContributionChart({ data, linesData }: Props) {
  const { chartData, people } = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const row of data) {
      for (const [k, v] of Object.entries(row)) {
        if (k === 'date') continue
        totals[k] = (totals[k] ?? 0) + Number(v)
      }
    }
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map(([n]) => n)
    const built = data.map(row => {
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
    return { chartData: built, people }
  }, [data])

  const { chartData: linesChartData, people: linesPeople } = useMemo(() => {
    if (!linesData?.length) return { chartData: [], people: [] }
    const totals: Record<string, number> = {}
    for (const row of linesData) {
      for (const [k, v] of Object.entries(row)) {
        if (k === 'date') continue
        totals[k] = (totals[k] ?? 0) + Number(v)
      }
    }
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map(([n]) => n)
    const built = linesData.map(row => {
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
    return { chartData: built, people }
  }, [linesData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
        <SectionTitle>Member Activity</SectionTitle>
        <Link
          href="/contributions"
          style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-jakarta)', textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          View details →
        </Link>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, marginTop: 2 }}>messages sent per week</div>
      {data.length === 0 ? <Empty h={160} /> : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} barSize={14}>
            <XAxis dataKey="date" tick={false} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis tick={{ fill: '#6b6560', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            {people.map((p, i) => (
              <Bar key={p} dataKey={p} stackId="a"
                fill={p === 'Others' ? OTHERS_COLOR : PALETTE[i % PALETTE.length]}
                radius={i === people.length - 1 ? [3, 3, 0, 0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {linesData && linesData.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>lines changed per week</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={linesChartData} barSize={14}>
              <XAxis dataKey="date" tick={{ fill: '#6b6560', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false}
                tickFormatter={(v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
              />
              <YAxis tick={{ fill: '#6b6560', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              {linesPeople.map((p, i) => (
                <Bar key={p} dataKey={p} stackId="b"
                  fill={p === 'Others' ? OTHERS_COLOR : PALETTE[i % PALETTE.length]}
                  radius={i === linesPeople.length - 1 ? [3, 3, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </motion.div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-serif)', fontWeight: 700,
      fontSize: 14, color: 'var(--text)', letterSpacing: '-0.01em',
    }}>
      {children}
    </div>
  )
}

function Empty({ h }: { h: number }) {
  return (
    <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
      No data yet — run a digest to populate
    </div>
  )
}
