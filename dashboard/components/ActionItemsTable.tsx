'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { SectionTitle } from './ContributionChart'
import type { ActionItem } from '@/app/page'

interface Props {
  items: ActionItem[]
  owners: string[]
  onToggle: (id: number, current: string) => void
}
type StatusFilter = 'all' | 'open' | 'done'

const PREVIEW = 5

export default function ActionItemsTable({ items, owners, onToggle }: Props) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [person, setPerson] = useState('all')

  const splitOwners = (owner: string) => (owner ?? '').split(',').map(n => n.trim()).filter(Boolean)

  const filtered = items.filter(i =>
    (status === 'all' || i.status === status) &&
    (person === 'all' || splitOwners(i.owner).includes(person))
  )

  const shown = filtered.slice(0, PREVIEW)
  const hasItems = filtered.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <SectionTitle>Action Items</SectionTitle>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {filtered.length} of {items.length} shown
            </div>
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
            {(['all', 'open', 'done'] as StatusFilter[]).map((f, i) => (
              <button key={f} onClick={() => setStatus(f)} style={{
                padding: '3px 10px', border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: status === f ? 'var(--text)' : 'transparent',
                color: status === f ? 'var(--bg)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{f}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <select value={person} onChange={e => setPerson(e.target.value)} style={selectStyle(person !== 'all')}>
            <option value="all">All people</option>
            {owners.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-dim)', fontSize: 13 }}>
          No items match filters
        </div>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {shown.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, delay: i * 0.02 }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  onClick={() => onToggle(item.id, item.status)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '9px 8px',
                    borderBottom: i < shown.length - 1 ? '1px solid var(--surface-raised)' : 'none',
                    cursor: 'pointer', transition: 'background 0.1s', borderRadius: 4,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {item.status === 'done'
                    ? <CheckCircle2 size={14} style={{ color: 'var(--green)', marginTop: 2, flexShrink: 0 }} />
                    : <Circle size={14} style={{ color: 'var(--text-dim)', marginTop: 2, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4, color: item.status === 'done' ? 'var(--text-muted)' : 'var(--text)' }}>
                      {item.task}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>→ {item.owner}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>#{item.channel}</span>
                      {item.deadline && item.deadline !== 'unspecified' && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={9} />{item.deadline}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {hasItems && (
            <Link
              href="/action-items"
              style={{
                display: 'inline-block', marginTop: 10, padding: '6px 0',
                fontSize: 12, color: 'var(--text-muted)',
                fontFamily: 'var(--font-jakarta)', textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              View all {filtered.length} items →
            </Link>
          )}
        </>
      )}
    </motion.div>
  )
}

function selectStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '4px 8px', fontSize: 11,
    fontFamily: 'var(--font-mono)',
    border: '1px solid var(--border)', borderRadius: 5,
    background: active ? 'var(--amber-light)' : 'var(--surface)',
    color: active ? 'var(--amber)' : 'var(--text-muted)',
    cursor: 'pointer', outline: 'none',
  }
}
