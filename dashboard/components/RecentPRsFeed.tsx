'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { GitPullRequest, ExternalLink, Clock } from 'lucide-react'
import { SectionTitle } from './ContributionChart'
import type { GithubPR } from '@/lib/github'

type ReviewState = GithubPR['reviewState']

const STATUS_META: Record<ReviewState, { label: string; color: string }> = {
  approved:          { label: 'Approved',          color: 'var(--green)' },
  changes_requested: { label: 'Changes requested', color: 'var(--red)'   },
  pending:           { label: 'Needs review',       color: 'var(--amber)' },
  none:              { label: 'No review',          color: 'var(--text-dim)' },
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

interface Props {
  prs: GithubPR[]
  connected: boolean
}

export default function RecentPRsFeed({ prs, connected }: Props) {
  const openCount = prs.filter(p => !p.draft).length
  const needsReview = prs.filter(p => p.reviewState === 'pending').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}
    >
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <SectionTitle>Pull Requests</SectionTitle>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {needsReview > 0
              ? <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{needsReview} needs review</span>
              : `${openCount} open`}
          </div>
        </div>
        <Link
          href="/github"
          style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-jakarta)', textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          View all →
        </Link>
      </div>

      {prs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: 13 }}>
          No open pull requests
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {prs.map((pr, i) => {
            const status = STATUS_META[pr.stale ? 'none' : pr.reviewState]
            const borderColor = pr.stale ? '#9ca3af' : status.color
            return (
              <motion.div
                key={pr.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.04, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  borderLeft: `3px solid ${borderColor}`,
                  background: 'transparent',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <GitPullRequest size={13} style={{ color: borderColor, marginTop: 2, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, fontWeight: 500 }}>
                      {pr.title}
                    </div>
                    {pr.url !== '#' && (
                      <a href={pr.url} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ flexShrink: 0, color: 'var(--text-dim)', opacity: 0.4, transition: 'opacity 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {pr.author}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', display: 'flex', gap: 3 }}>
                      <span style={{ color: 'var(--green)' }}>+{pr.additions}</span>
                      <span style={{ color: 'var(--red)' }}>−{pr.deletions}</span>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={9} />{timeAgo(pr.updatedAt)}
                    </span>
                    <span style={{ fontSize: 11, color: pr.stale ? '#9ca3af' : status.color, fontFamily: 'var(--font-mono)' }}>
                      {pr.stale ? 'Stale' : status.label}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
