'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, X, Check } from 'lucide-react'

interface Channel { id: string; name: string }
interface Member { id: string; name: string }

export default function SettingsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<Channel[]>([])
  const [channelSearch, setChannelSearch] = useState('')
  const [channelOpen, setChannelOpen] = useState(false)
  const [manager, setManager] = useState<Member | null>(null)
  const [managerSearch, setManagerSearch] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const [backfillDays, setBackfillDays] = useState(30)
  const [scheduleInterval, setScheduleInterval] = useState('weekly')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pendingChannelNames, setPendingChannelNames] = useState<string[]>([])
  const [pendingManagerId, setPendingManagerId] = useState<string>('')

  useEffect(() => {
    fetch('/api/workspace').then(r => r.json()).then(d => {
      setBackfillDays(d.backfillDays ?? 30)
      setScheduleInterval(d.scheduleInterval ?? 'weekly')
      if (d.channels?.length) setPendingChannelNames(d.channels)
      if (d.managerSlackId) setPendingManagerId(d.managerSlackId)
    })
    fetch('/api/slack/channels').then(r => r.json()).then(d => setChannels(d.channels ?? []))
    fetch('/api/slack/users').then(r => r.json()).then(d => setMembers(d.members ?? []))
  }, [])

  // Pre-select channels once both channels list and pending names are ready
  useEffect(() => {
    if (pendingChannelNames.length > 0 && channels.length > 0) {
      const pre = channels.filter(c => pendingChannelNames.includes(c.name))
      if (pre.length > 0) setSelected(pre)
      setPendingChannelNames([])
    }
  }, [channels, pendingChannelNames])

  // Pre-select manager once both members list and pending id are ready
  useEffect(() => {
    if (pendingManagerId && members.length > 0) {
      const m = members.find(m => m.id === pendingManagerId)
      if (m) setManager(m)
      setPendingManagerId('')
    }
  }, [members, pendingManagerId])

  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(channelSearch.toLowerCase()) &&
    !selected.find(s => s.id === c.id)
  )

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(managerSearch.toLowerCase())
  )

  const toggleChannel = (ch: Channel) => {
    setSelected(prev => prev.find(s => s.id === ch.id)
      ? prev.filter(s => s.id !== ch.id)
      : [...prev, ch])
  }

  const save = async () => {
    setSaving(true)
    await fetch('/api/workspace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: selected.map(c => c.name),
        managerSlackId: manager?.id ?? '',
        backfillDays,
        scheduleInterval,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const isCustomDays = ![30, 60, 90, 180].includes(backfillDays)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
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
        <span style={{
          fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 14,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Settings
        </span>
        <div style={{ width: 120 }} />
      </header>

      <main style={{ maxWidth: 520, margin: '48px auto', padding: '0 24px 80px' }}>

        {/* Channels section */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700,
            marginBottom: 6, color: 'var(--text)',
          }}>
            Channels
          </h2>
          <p style={{
            fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)',
            marginBottom: 16, lineHeight: 1.6,
          }}>
            Channels to monitor for digest generation.
          </p>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {selected.map(ch => (
                <div key={ch.id} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'var(--amber-light)', border: '1px solid var(--amber)',
                  borderRadius: 20, padding: '3px 10px',
                  fontSize: 12, color: 'var(--amber)', fontFamily: 'var(--font-mono)',
                }}>
                  #{ch.name}
                  <button
                    onClick={() => toggleChannel(ch)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--amber)' }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Channel picker */}
          <div style={{ position: 'relative' }}>
            <input
              value={channelSearch}
              onChange={e => { setChannelSearch(e.target.value); setChannelOpen(true) }}
              onFocus={() => setChannelOpen(true)}
              onBlur={() => setTimeout(() => setChannelOpen(false), 150)}
              placeholder="Search channels…"
              style={{
                width: '100%', padding: '10px 14px', boxSizing: 'border-box',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
            {channelOpen && filteredChannels.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                zIndex: 200, maxHeight: 220, overflowY: 'auto',
              }}>
                {filteredChannels.slice(0, 20).map(ch => (
                  <div
                    key={ch.id}
                    onMouseDown={() => { toggleChannel(ch); setChannelSearch('') }}
                    style={{
                      padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-mono)',
                      cursor: 'pointer', color: 'var(--text)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: 'var(--text-dim)' }}>#</span>{ch.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 40 }} />

        {/* Manager section */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700,
            marginBottom: 6, color: 'var(--text)',
          }}>
            Digest Recipient
          </h2>
          <p style={{
            fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)',
            marginBottom: 16, lineHeight: 1.6,
          }}>
            The digest will be sent as a Slack DM to this person after each run.
          </p>

          {manager && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              background: 'var(--amber-light)', border: '1px solid var(--amber)',
              borderRadius: 8, padding: '10px 14px',
            }}>
              <span style={{
                fontSize: 13, color: 'var(--amber)',
                fontFamily: 'var(--font-jakarta)', fontWeight: 600,
              }}>
                {manager.name}
              </span>
              <button
                onClick={() => setManager(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--amber)', marginLeft: 'auto' }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <input
              value={managerSearch}
              onChange={e => { setManagerSearch(e.target.value); setManagerOpen(true) }}
              onFocus={() => setManagerOpen(true)}
              onBlur={() => setTimeout(() => setManagerOpen(false), 150)}
              placeholder="Search team members…"
              style={{
                width: '100%', padding: '10px 14px', boxSizing: 'border-box',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
            {managerOpen && filteredMembers.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                zIndex: 200, maxHeight: 220, overflowY: 'auto',
              }}>
                {filteredMembers.slice(0, 20).map(m => (
                  <div
                    key={m.id}
                    onMouseDown={() => { setManager(m); setManagerSearch(''); setManagerOpen(false) }}
                    style={{
                      padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-jakarta)',
                      cursor: 'pointer', color: 'var(--text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {m.name}
                    {manager?.id === m.id && <Check size={13} style={{ color: 'var(--green)' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 40 }} />

        {/* Backfill days section */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700,
            marginBottom: 6, color: 'var(--text)',
          }}>
            Backfill Window
          </h2>
          <p style={{
            fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)',
            marginBottom: 20, lineHeight: 1.6,
          }}>
            How far back to import history on the first run.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {[30, 60, 90, 180].map(n => (
              <button
                key={n}
                onClick={() => setBackfillDays(n)}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  border: `1px solid ${backfillDays === n ? 'var(--amber)' : 'var(--border)'}`,
                  background: backfillDays === n ? 'var(--amber-light)' : 'var(--surface)',
                  color: backfillDays === n ? 'var(--amber)' : 'var(--text-muted)',
                  fontSize: 13, fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontWeight: backfillDays === n ? 600 : 400,
                }}
              >
                {n}d
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              min={1}
              max={365}
              value={backfillDays}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v > 0) setBackfillDays(v)
              }}
              style={{
                width: 80, padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${isCustomDays ? 'var(--amber)' : 'var(--border)'}`,
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 13, fontFamily: 'var(--font-mono)',
                outline: 'none', textAlign: 'center',
              }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>custom days</span>
          </div>
        </section>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 40 }} />

        {/* Schedule interval section */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700,
            marginBottom: 6, color: 'var(--text)',
          }}>
            Digest Schedule
          </h2>
          <p style={{
            fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)',
            marginBottom: 20, lineHeight: 1.6,
          }}>
            How often to automatically run the digest.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map(interval => (
              <button
                key={interval}
                onClick={() => setScheduleInterval(interval)}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  border: `1px solid ${scheduleInterval === interval ? 'var(--amber)' : 'var(--border)'}`,
                  background: scheduleInterval === interval ? 'var(--amber-light)' : 'var(--surface)',
                  color: scheduleInterval === interval ? 'var(--amber)' : 'var(--text-muted)',
                  fontSize: 13, fontFamily: 'var(--font-jakarta)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontWeight: scheduleInterval === interval ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {interval === 'biweekly' ? 'Biweekly' : interval.charAt(0).toUpperCase() + interval.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={save}
            disabled={saving || selected.length === 0 || !manager}
            style={{
              padding: '11px 32px', borderRadius: 8, border: 'none',
              background: (selected.length > 0 && manager && !saving) ? 'var(--amber)' : 'var(--border)',
              color: (selected.length > 0 && manager && !saving) ? '#fff' : 'var(--text-dim)',
              fontSize: 14, fontFamily: 'var(--font-jakarta)', fontWeight: 600,
              cursor: (saving || selected.length === 0 || !manager) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>

          {saved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: 'var(--green)', fontFamily: 'var(--font-jakarta)',
              fontWeight: 500,
            }}>
              <Check size={14} /> Saved!
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
