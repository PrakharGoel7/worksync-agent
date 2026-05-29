'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { SectionTitle } from './ContributionChart'
import type { Decision } from '@/app/page'

const PREVIEW = 3

interface Props {
  decisions: Decision[]
}

export default function DecisionsLog({ decisions: initial }: Props) {
  const [decisions, setDecisions] = useState(initial)
  const unread = decisions.filter(d => !d.read).length
  const shown = decisions.slice(0, PREVIEW)
  const hasMore = decisions.length > PREVIEW

  const markRead = async (id: number) => {
    await fetch(`/api/decisions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
    setDecisions(prev => prev.map(d => d.id === id ? { ...d, read: 1 } : d))
  }

  const markAllRead = async () => {
    await fetch('/api/decisions', { method: 'POST' })
    setDecisions(prev => prev.map(d => ({ ...d, read: 1 })))
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}
    >
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <SectionTitle>Key Decisions</SectionTitle>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {unread > 0 ? (
              <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{unread} unread</span>
            ) : 'No unread decisions'}
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            style={{
              fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-jakarta)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            Mark all read
          </button>
        )}
      </div>

      {decisions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: 13 }}>
          No decisions logged yet
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map(d => (
              <div
                key={d.id}
                onClick={() => !d.read && markRead(d.id)}
                style={{
                  padding: '10px 14px', borderRadius: 6,
                  background: d.read ? 'transparent' : 'var(--blue-light)',
                  borderLeft: `3px solid ${d.read ? 'var(--border)' : 'var(--blue)'}`,
                  cursor: d.read ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {!d.read && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)',
                      flexShrink: 0, marginTop: 5,
                    }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13, lineHeight: 1.5,
                      color: d.read ? 'var(--text-muted)' : 'var(--text)',
                      fontWeight: d.read ? 400 : 500,
                    }}>
                      {d.decision}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 5 }}>
                      {d.channel ? `#${d.channel} · ` : ''}
                      {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <Link
              href="/decisions"
              style={{
                display: 'inline-block', marginTop: 10, padding: '6px 0',
                fontSize: 12, color: 'var(--text-muted)',
                fontFamily: 'var(--font-jakarta)', textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              View all {decisions.length} decisions →
            </Link>
          )}
        </>
      )}
    </motion.div>
  )
}
