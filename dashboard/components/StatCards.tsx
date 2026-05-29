'use client'
import { motion } from 'framer-motion'
import { MessageSquare, CheckSquare, AlertTriangle, Users } from 'lucide-react'

interface Stats {
  totalMessages: number
  openActionItems: number
  activeBlockers: number
  activeContributors: number
  totalDigests: number
}

const CARDS = [
  { key: 'totalMessages',      label: 'Messages Analyzed', icon: MessageSquare, color: 'var(--blue)',  bg: 'var(--blue-light)'  },
  { key: 'openActionItems',    label: 'Open Action Items',  icon: CheckSquare,   color: 'var(--amber)', bg: 'var(--amber-light)' },
  { key: 'activeBlockers',     label: 'Active Blockers',    icon: AlertTriangle, color: 'var(--red)',   bg: 'var(--red-light)'   },
  { key: 'activeContributors', label: 'Contributors',       icon: Users,         color: 'var(--green)', bg: 'var(--green-light)' },
]

export default function StatCards({ stats }: { stats: Stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
      {CARDS.map((card, i) => {
        const Icon = card.icon
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '18px 22px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{
                  fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
                  letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10,
                  fontFamily: 'var(--font-jakarta)',
                }}>
                  {card.label}
                </div>
                <div style={{
                  fontSize: 32, fontWeight: 700,
                  fontFamily: 'var(--font-serif)',
                  color: 'var(--text)',
                  lineHeight: 1,
                }}>
                  {stats[card.key as keyof Stats]}
                </div>
              </div>
              <div style={{
                padding: 8, borderRadius: 8, background: card.bg,
              }}>
                <Icon size={15} style={{ color: card.color, display: 'block' }} />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
