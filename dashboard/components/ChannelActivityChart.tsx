'use client'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { SectionTitle } from './ContributionChart'

const PALETTE = ['#d97706', '#1d4ed8', '#15803d', '#dc2626', '#7c3aed']

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>#{label}</div>
      <div style={{ color: 'var(--text)', fontWeight: 700, fontFamily: 'var(--font-serif)' }}>{payload[0].value} items</div>
    </div>
  )
}

export default function ChannelActivityChart({ data }: { data: Array<{ channel: string; count: number }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}
    >
      <SectionTitle>Channel Activity</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, marginTop: 2 }}>
        Action items and blockers per channel
      </div>
      {data.length === 0 ? (
        <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          No channel data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={data} barSize={32}>
            <XAxis dataKey="channel" tick={{ fill: '#6b6560', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis tick={{ fill: '#6b6560', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  )
}
