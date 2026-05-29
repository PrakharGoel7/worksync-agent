'use client'
import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, Search, X, Mail, MailOpen } from 'lucide-react'
interface Decision {
  id: number
  decision: string
  channel: string
  createdAt: string
  read: number
}

type ReadFilter = 'all' | 'unread' | 'read'

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterChannel, setFilterChannel] = useState('all')
  const [filterRead, setFilterRead] = useState<ReadFilter>('all')

  useEffect(() => {
    fetch('/api/dashboard?days=9999')
      .then(r => r.json())
      .then(d => { setDecisions(d.decisions); setLoading(false) })

  }, [])

  const channels = useMemo(() => {
    const s = new Set(decisions.map(d => d.channel).filter(Boolean))
    return ['all', ...Array.from(s).sort()]
  }, [decisions])

  const shown = decisions.filter(d =>
    (filterChannel === 'all' || d.channel === filterChannel) &&
    (filterRead === 'all' || (filterRead === 'unread' ? !d.read : !!d.read)) &&
    (!search.trim() || d.decision.toLowerCase().includes(search.toLowerCase()))
  )

  const unreadCount = decisions.filter(d => !d.read).length

  const toggleRead = async (id: number, current: number) => {
    const next = current ? 0 : 1
    await fetch(`/api/decisions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: !!next }),
    })
    setDecisions(prev => prev.map(d => d.id === id ? { ...d, read: next } : d))
  }

  const markAllRead = async () => {
    await fetch('/api/decisions', { method: 'POST' })
    setDecisions(prev => prev.map(d => ({ ...d, read: 1 })))
  }

  const remove = async (id: number) => {
    await fetch(`/api/decisions/${id}`, { method: 'DELETE' })
    setDecisions(prev => prev.filter(d => d.id !== id))
  }

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
          All Decisions
        </span>
        <div style={{ width: 120 }} />
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 36px 64px' }}>
        {/* Filters row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search decisions…"
              style={{
                padding: '6px 10px 6px 28px', width: 200,
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['all', 'unread', 'read'] as ReadFilter[]).map((f, i) => (
              <button key={f} onClick={() => setFilterRead(f)} style={{
                padding: '5px 14px', border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)',
                background: filterRead === f ? 'var(--text)' : 'transparent',
                color: filterRead === f ? 'var(--bg)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{f}</button>
            ))}
          </div>
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={selectStyle(filterChannel !== 'all')}>
            <option value="all">All channels</option>
            {channels.slice(1).map(c => <option key={c} value={c}>#{c}</option>)}
          </select>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-jakarta)',
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                cursor: 'pointer', padding: '5px 12px', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
            >
              Mark all read
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            {shown.length} of {decisions.length}
          </span>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>No decisions match filters</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  padding: '14px 18px', borderRadius: 8,
                  background: d.read ? 'var(--surface)' : 'var(--blue-light)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${d.read ? 'var(--border)' : 'var(--blue)'}`,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                {/* Read toggle — left side, like resolve circle on blockers */}
                <button
                  onClick={() => toggleRead(d.id, d.read)}
                  title={d.read ? 'Mark as unread' : 'Mark as read'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, flexShrink: 0 }}
                >
                  {d.read
                    ? <MailOpen size={16} style={{ color: 'var(--text-dim)' }} />
                    : <Mail size={16} style={{ color: 'var(--blue)' }} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: d.read ? 'var(--text-muted)' : 'var(--text)',
                    lineHeight: 1.6, fontWeight: d.read ? 400 : 500,
                  }}>
                    {d.decision}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {d.channel && (
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>#{d.channel}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => remove(d.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, opacity: 0.35, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}
                >
                  <X size={13} style={{ color: 'var(--text-muted)' }} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function selectStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 10px', fontSize: 12, fontFamily: 'var(--font-mono)',
    border: '1px solid var(--border)', borderRadius: 6,
    background: active ? 'var(--blue-light)' : 'var(--surface)',
    color: active ? 'var(--blue)' : 'var(--text-muted)',
    cursor: 'pointer', outline: 'none',
  }
}
