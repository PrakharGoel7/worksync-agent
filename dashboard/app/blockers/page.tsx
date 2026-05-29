'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, ChevronDown, Search, X, CheckCircle2, Circle } from 'lucide-react'
import MessageModal from '@/components/MessageModal'
import MemberSearch, { type SlackMember } from '@/components/MemberSearch'
interface Blocker {
  id: number
  description: string
  affected: string
  affectedIds: string
  channel: string
  messageDate: string
  status: string
}

type StatusFilter = 'all' | 'open' | 'resolved'

interface MessageDropdownProps {
  assignees: SlackMember[]
  onSelect: (m: SlackMember) => void
}

function MessageDropdown({ assignees, onSelect }: MessageDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (assignees.length === 1) {
    return (
      <button
        onClick={() => onSelect(assignees[0])}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--surface)',
          cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
          fontFamily: 'var(--font-jakarta)', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
      >
        <MessageSquare size={12} /> Message {assignees[0].name.split(' ')[0]}
      </button>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 6,
          border: `1px solid ${open ? 'var(--amber)' : 'var(--border)'}`,
          background: 'var(--surface)', cursor: 'pointer', fontSize: 12,
          color: open ? 'var(--amber)' : 'var(--text-muted)',
          fontFamily: 'var(--font-jakarta)', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
        onMouseLeave={e => {
          if (!open) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }
        }}
      >
        <MessageSquare size={12} /> Message <ChevronDown size={11} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 200, minWidth: 160, overflow: 'hidden',
        }}>
          {assignees.map(a => (
            <div
              key={a.id}
              onMouseDown={() => { onSelect(a); setOpen(false) }}
              style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--text)', transition: 'background 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {a.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type DateRange = 'all' | 'day' | 'week' | 'month' | 'custom'

function inDateRange(dateStr: string, range: DateRange, from: string, to: string): boolean {
  if (range === 'all') return true
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return true
  const now = Date.now()
  if (range === 'day')   return d.getTime() >= now - 86400_000
  if (range === 'week')  return d.getTime() >= now - 7 * 86400_000
  if (range === 'month') return d.getTime() >= now - 30 * 86400_000
  if (range === 'custom') {
    if (from && d < new Date(from)) return false
    if (to   && d > new Date(to + 'T23:59:59')) return false
    return true
  }
  return true
}

export default function BlockersPage() {
  const [blockers, setBlockers] = useState<Blocker[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<SlackMember[]>([])
  const [members, setMembers] = useState<SlackMember[]>([])
  const [modal, setModal] = useState<{ recipient: string; userId?: string; context: string } | null>(null)
  const [filterChannel, setFilterChannel] = useState('all')
  const [filterPerson, setFilterPerson] = useState('all')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('open')
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('person')
    if (p) setFilterPerson(p)
  }, [])

  useEffect(() => {
    fetch('/api/dashboard?days=9999')
      .then(r => r.json())
      .then(d => { setBlockers(d.blockers); setLoading(false) })

    fetch('/api/slack/users')
      .then(r => r.json())
      .then(d => setMembers(d.members ?? []))
  }, [])

  const channels = useMemo(() => {
    const s = new Set(blockers.map(b => b.channel).filter(Boolean))
    return ['all', ...Array.from(s).sort()]
  }, [blockers])

  const people = useMemo(() => {
    const s = new Set<string>()
    blockers.forEach(b => b.affected.split(', ').filter(Boolean).forEach(n => s.add(n)))
    return ['all', ...Array.from(s).sort()]
  }, [blockers])

  const filtered = blockers.filter(b =>
    (filterStatus === 'all' || (filterStatus === 'open' ? (!b.status || b.status === 'open') : b.status === 'resolved')) &&
    (filterChannel === 'all' || b.channel === filterChannel) &&
    (filterPerson === 'all' || b.affected.split(', ').includes(filterPerson)) &&
    (!search.trim() || b.description.toLowerCase().includes(search.toLowerCase())) &&
    inDateRange(b.messageDate, dateRange, customFrom, customTo)
  )

  const toggleStatus = async (id: number, current: string) => {
    const next = (!current || current === 'open') ? 'resolved' : 'open'
    await fetch(`/api/blockers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setBlockers(prev => prev.map(b => b.id === id ? { ...b, status: next } : b))
  }

  const startEdit = (b: Blocker) => {
    setEditing(b.id)
    const names = b.affected ? b.affected.split(', ').filter(Boolean) : []
    const ids = b.affectedIds ? b.affectedIds.split(',').filter(Boolean) : []
    setEditValues(names.map((name, i) => ({ name, id: ids[i] ?? '' })))
  }

  const remove = async (id: number) => {
    await fetch(`/api/blockers/${id}`, { method: 'DELETE' })
    setBlockers(prev => prev.filter(b => b.id !== id))
  }

  const saveEdit = async (id: number) => {
    if (editValues.length === 0) return
    const affected = editValues.map(v => v.name).join(', ')
    const affectedIds = editValues.map(v => v.id).join(',')
    await fetch(`/api/blockers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affected, affectedIds }),
    })
    setBlockers(prev => prev.map(b => b.id === id ? { ...b, affected, affectedIds } : b))
    setEditing(null)
  }

  const parseAssignees = (b: Blocker): SlackMember[] => {
    const names = b.affected ? b.affected.split(', ').filter(Boolean) : []
    const ids = b.affectedIds ? b.affectedIds.split(',').filter(Boolean) : []
    return names.map((name, i) => ({ name, id: ids[i] ?? '' }))
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
          All Blockers
        </span>
        <div style={{ width: 120 }} />
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 36px 64px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search blockers…"
              style={{
                padding: '6px 10px 6px 28px', width: 180,
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['all', 'open', 'resolved'] as StatusFilter[]).map((f, i) => (
              <button key={f} onClick={() => setFilterStatus(f)} style={{
                padding: '5px 14px', border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)',
                background: filterStatus === f ? 'var(--text)' : 'transparent',
                color: filterStatus === f ? 'var(--bg)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{f}</button>
            ))}
          </div>
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={selectStyle(filterChannel !== 'all')}>
            <option value="all">All channels</option>
            {channels.slice(1).map(c => <option key={c} value={c}>#{c}</option>)}
          </select>
          <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)} style={selectStyle(filterPerson !== 'all')}>
            <option value="all">All people</option>
            {people.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            {filtered.length} of {blockers.length}
          </span>
        </div>

        {/* Date range filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          {([
            { label: 'All time', value: 'all' },
            { label: 'Last day', value: 'day' },
            { label: 'Last week', value: 'week' },
            { label: 'Last month', value: 'month' },
            { label: 'Custom', value: 'custom' },
          ] as { label: string; value: DateRange }[]).map(opt => (
            <button key={opt.value} onClick={() => setDateRange(opt.value)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12,
              border: `1px solid ${dateRange === opt.value ? 'var(--amber)' : 'var(--border)'}`,
              background: dateRange === opt.value ? 'var(--amber-light)' : 'var(--surface)',
              color: dateRange === opt.value ? 'var(--amber)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s',
            }}>{opt.label}</button>
          ))}
          {dateRange === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={{ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', outline: 'none' }} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={{ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', outline: 'none' }} />
            </>
          )}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 15, fontFamily: 'var(--font-serif)' }}>{blockers.length === 0 ? 'No blockers on record' : 'No items match filters'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((b, i) => {
              const assignees = parseAssignees(b)
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${b.status === 'resolved' ? 'var(--green)' : 'var(--red)'}`,
                    borderRadius: 8, padding: '14px 18px',
                    opacity: b.status === 'resolved' ? 0.6 : 1,
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}
                >
                  {/* Resolve toggle — left side, like action items */}
                  <button
                    onClick={() => toggleStatus(b.id, b.status)}
                    title={b.status === 'resolved' ? 'Mark as open' : 'Mark as resolved'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, flexShrink: 0 }}
                  >
                    {b.status === 'resolved'
                      ? <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
                      : <Circle size={16} style={{ color: 'var(--text-dim)' }} />}
                  </button>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 10 }}>
                    {b.description}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', paddingTop: 3 }}>assigned to</span>
                        {editing === b.id ? (
                          <MemberSearch
                            values={editValues}
                            members={members}
                            onChange={setEditValues}
                            onConfirm={() => saveEdit(b.id)}
                            onCancel={() => setEditing(null)}
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(b)}
                            style={{
                              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            }}
                          >
                            {assignees.map(a => (
                              <span key={a.id || a.name} style={{ fontSize: 12, color: 'var(--red)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {a.name}
                              </span>
                            ))}
                            <ChevronDown size={11} style={{ color: 'var(--text-dim)' }} />
                          </button>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', paddingTop: 3 }}>#{b.channel}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', paddingTop: 3 }}>
                        {new Date(b.messageDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {assignees.length > 0 && (
                        <MessageDropdown
                          assignees={assignees}
                          onSelect={m => setModal({ recipient: m.name, userId: m.id || undefined, context: b.description })}
                        />
                      )}
                      <button
                        onClick={() => remove(b.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.35, transition: 'opacity 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}
                      >
                        <X size={13} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </div>
                  </div>
                  </div>{/* end content */}
                </motion.div>
              )
            })}
          </div>
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

function selectStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 10px', fontSize: 12, fontFamily: 'var(--font-mono)',
    border: '1px solid var(--border)', borderRadius: 6,
    background: active ? 'var(--amber-light)' : 'var(--surface)',
    color: active ? 'var(--amber)' : 'var(--text-muted)',
    cursor: 'pointer', outline: 'none',
  }
}
