'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { SectionTitle } from './ContributionChart'
import type { Blocker } from '@/app/page'

const PREVIEW = 3

interface Props {
  blockers: Blocker[]
}

export default function BlockersFeed({ blockers }: Props) {
  const open = blockers.filter(b => !b.status || b.status === 'open')
  const shown = open.slice(0, PREVIEW)
  const hasBlockers = open.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}
    >
      <div style={{ marginBottom: 14 }}>
        <SectionTitle>Blockers</SectionTitle>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {open.length === 0 ? 'All clear' : `${open.length} open`}
        </div>
      </div>

      {open.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '16px 0',
          color: 'var(--green)', fontSize: 13,
          background: 'var(--green-light)', borderRadius: 6,
          border: '1px solid #bbf7d0',
        }}>
          ✓ No blockers this period
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map(b => (
              <div
                key={b.id}
                style={{
                  padding: '11px 14px', borderRadius: 6,
                  background: 'var(--red-light)',
                  borderLeft: '3px solid var(--red)',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>{b.description}</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>→ {b.affected}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>#{b.channel}</span>
                </div>
              </div>
            ))}
          </div>

          {hasBlockers && (
            <Link
              href="/blockers"
              style={{
                display: 'inline-block', marginTop: 10, padding: '6px 0',
                fontSize: 12, color: 'var(--text-muted)',
                fontFamily: 'var(--font-jakarta)', textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              View all {open.length} blockers →
            </Link>
          )}
        </>
      )}
    </motion.div>
  )
}
