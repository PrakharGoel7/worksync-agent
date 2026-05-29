'use client'
import { useState, useRef, useEffect } from 'react'
import { Check, X } from 'lucide-react'

export interface SlackMember {
  id: string
  name: string
}

interface Props {
  values: SlackMember[]
  members: SlackMember[]
  onChange: (v: SlackMember[]) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function MemberSearch({ values, members, onChange, onConfirm, onCancel }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedIds = new Set(values.map(v => v.id))
  const available = members.filter(m => !selectedIds.has(m.id))
  const filtered = query.trim()
    ? available.filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
    : available

  const add = (m: SlackMember) => {
    onChange([...values, m])
    setQuery('')
    inputRef.current?.focus()
  }

  const remove = (id: string) => onChange(values.filter(v => v.id !== id))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
      <div ref={containerRef} style={{ position: 'relative' }}>
        <div
          onClick={() => { setOpen(true); inputRef.current?.focus() }}
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
            padding: '3px 6px', borderRadius: 4, minWidth: 180, maxWidth: 280,
            border: '1px solid var(--amber)', background: 'var(--amber-light)', cursor: 'text',
          }}
        >
          {values.map(v => (
            <span key={v.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 6px', borderRadius: 3,
              background: 'var(--amber)', color: '#fff',
              fontSize: 11, fontFamily: 'var(--font-mono)',
            }}>
              {v.name}
              <button
                onMouseDown={e => { e.stopPropagation(); remove(v.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'rgba(255,255,255,0.8)', display: 'flex' }}
              >
                <X size={9} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => {
              if (e.key === 'Backspace' && !query && values.length > 0) remove(values[values.length - 1].id)
              if (e.key === 'Enter') { onConfirm(); setOpen(false) }
              if (e.key === 'Escape') onCancel()
            }}
            placeholder={values.length === 0 ? 'Search name…' : ''}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text)',
              minWidth: 80, flex: 1,
            }}
          />
        </div>
        {open && filtered.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 3,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            maxHeight: 180, overflowY: 'auto', zIndex: 200, minWidth: 200,
          }}>
            {filtered.map(m => (
              <div
                key={m.id}
                onMouseDown={() => add(m)}
                style={{ padding: '7px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--text)', transition: 'background 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {m.name}
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onConfirm} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, marginTop: 4 }}>
        <Check size={13} style={{ color: 'var(--green)' }} />
      </button>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, marginTop: 4 }}>
        <X size={13} style={{ color: 'var(--text-muted)' }} />
      </button>
    </div>
  )
}
