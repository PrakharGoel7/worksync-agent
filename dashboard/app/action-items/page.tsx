'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Circle, Clock, MessageSquare, ChevronDown, Search, X } from 'lucide-react'
import MessageModal from '@/components/MessageModal'
import MemberSearch, { type SlackMember } from '@/components/MemberSearch'
interface ActionItem {
  id: number
  owner: string
  ownerIds: string
  task: string
  deadline: string
  channel: string
  status: string
  createdAt: string
}

type StatusFilter = 'all' | 'open' | 'done'
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

function parseOwners(item: ActionItem): SlackMember[] {
  const names = item.owner ? item.owner.split(', ').filter(Boolean) : []
  const ids = item.ownerIds ? item.ownerIds.split(',').filter(Boolean) : []
  return names.map((name, i) => ({ name, id: ids[i] ?? '' }))
}

function isSpecified(d: string) { return d && d !== 'unspecified' }


interface RemindDropdownProps {
  owners: SlackMember[]
  onSelect: (m: SlackMember) => void
}

function RemindDropdown({ owners, onSelect }: RemindDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (owners.length === 1) {
    return (
      <button
        onClick={() => onSelect(owners[0])}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent',
          cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)',
          fontFamily: 'var(--font-jakarta)', flexShrink: 0, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
      >
        <MessageSquare size={11} /> Remind
      </button>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 6,
          border: `1px solid ${open ? 'var(--amber)' : 'var(--border)'}`,
          background: 'transparent', cursor: 'pointer', fontSize: 11,
          color: open ? 'var(--amber)' : 'var(--text-muted)',
          fontFamily: 'var(--font-jakarta)', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
        onMouseLeave={e => {
          if (!open) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }
        }}
      >
        <MessageSquare size={11} /> Remind <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 200, minWidth: 160, overflow: 'hidden',
        }}>
          {owners.map(o => (
            <div
              key={o.id || o.name}
              onMouseDown={() => { onSelect(o); setOpen(false) }}
              style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--text)', transition: 'background 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {o.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface DeadlineCellProps {
  item: ActionItem
  onSave: (id: number, deadline: string) => void
}

function DeadlineCell({ item, onSave }: DeadlineCellProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(isSpecified(item.deadline) ? item.deadline : '')

  const commit = (val: string) => {
    setEditing(false)
    const next = val || 'unspecified'
    if (next !== item.deadline) onSave(item.id, next)
  }

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit(value)
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text)',
          border: '1px solid var(--amber)', borderRadius: 4, padding: '2px 6px',
          background: 'var(--surface)', outline: 'none', cursor: 'pointer',
        }}
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontSize: 11, color: isSpecified(item.deadline) ? 'var(--text-muted)' : 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
      }}
      title="Click to edit deadline"
    >
      <Clock size={9} />
      {isSpecified(item.deadline) ? item.deadline : 'add date'}
    </button>
  )
}

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [channel, setChannel] = useState('all')
  const [person, setPerson] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [members, setMembers] = useState<SlackMember[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<SlackMember[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ recipient: string; userId?: string; context: string } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('person')
    if (p) setPerson(p)
  }, [])

  useEffect(() => {
    fetch('/api/dashboard?days=9999')
      .then(r => r.json())
      .then(d => { setItems(d.actionItems); setLoading(false) })

    fetch('/api/slack/users')
      .then(r => r.json())
      .then(d => setMembers(d.members ?? []))
  }, [])

  const channels = useMemo(() => ['all', ...Array.from(new Set(items.map(i => i.channel))).sort()], [items])
  const splitOwners = (owner: string) => owner.split(',').map(n => n.trim()).filter(Boolean)

  const people = useMemo(() => {
    const s = new Set<string>()
    items.forEach(i => splitOwners(i.owner ?? '').forEach(n => s.add(n)))
    return ['all', ...Array.from(s).sort()]
  }, [items])

  const filtered = items.filter(i =>
    (status === 'all' || i.status === status) &&
    (channel === 'all' || i.channel === channel) &&
    (person === 'all' || splitOwners(i.owner ?? '').includes(person)) &&
    (!search.trim() || i.task.toLowerCase().includes(search.toLowerCase())) &&
    inDateRange(i.createdAt, dateRange, customFrom, customTo)
  )
  const shown = filtered

  const toggle = async (id: number, current: string) => {
    const next = current === 'done' ? 'open' : 'done'
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: next } : i))
  }

  const startEdit = (item: ActionItem) => {
    setEditing(item.id)
    setEditValues(parseOwners(item))
  }

  const remove = async (id: number) => {
    await fetch(`/api/action-items/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const saveEdit = async (id: number) => {
    if (editValues.length === 0) return
    const owner = editValues.map(v => v.name).join(', ')
    const ownerIds = editValues.map(v => v.id).join(',')
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, ownerIds }),
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, owner, ownerIds } : i))
    setEditing(null)
  }

  const saveDeadline = async (id: number, deadline: string) => {
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deadline }),
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, deadline } : i))
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
          All Action Items
        </span>
        <div style={{ width: 120 }} />
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 36px 64px' }}>
        {/* Row 1: search + status + channel + person + count */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              style={{
                padding: '6px 10px 6px 28px', width: 180,
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['all', 'open', 'done'] as StatusFilter[]).map((f, i) => (
              <button key={f} onClick={() => setStatus(f)} style={{
                padding: '5px 14px', border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)',
                background: status === f ? 'var(--text)' : 'transparent',
                color: status === f ? 'var(--bg)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{f}</button>
            ))}
          </div>
          <select value={channel} onChange={e => setChannel(e.target.value)} style={selectStyle(channel !== 'all')}>
            <option value="all">All channels</option>
            {channels.slice(1).map(c => <option key={c} value={c}>#{c}</option>)}
          </select>
          <select value={person} onChange={e => setPerson(e.target.value)} style={selectStyle(person !== 'all')}>
            <option value="all">All people</option>
            {people.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            {shown.length} of {items.length}
          </span>
        </div>

        {/* Row 3: date range */}
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
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>No items match filters</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map((item, i) => {
              const owners = parseOwners(item)
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '14px 18px',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggle(item.id, item.status)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, flexShrink: 0 }}
                  >
                    {item.status === 'done'
                      ? <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
                      : <Circle size={16} style={{ color: 'var(--text-dim)' }} />}
                  </button>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: item.status === 'done' ? 'var(--text-muted)' : 'var(--text)' }}>
                      {item.task}
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {editing === item.id ? (
                        <MemberSearch
                          values={editValues}
                          members={members}
                          onChange={setEditValues}
                          onConfirm={() => saveEdit(item.id)}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(item)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          }}
                        >
                          <span style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                            → {owners.map(o => o.name).join(', ') || item.owner}
                          </span>
                          <ChevronDown size={10} style={{ color: 'var(--text-dim)' }} />
                        </button>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>#{item.channel}</span>
                      <DeadlineCell item={item} onSave={saveDeadline} />
                    </div>
                  </div>

                  {/* Remind + delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {owners.length > 0 && (
                      <RemindDropdown
                        owners={owners}
                        onSelect={m => setModal({ recipient: m.name, userId: m.id || undefined, context: item.task })}
                      />
                    )}
                    <button
                      onClick={() => remove(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.35, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}
                    >
                      <X size={13} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>
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
