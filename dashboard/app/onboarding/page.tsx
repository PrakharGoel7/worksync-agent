'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, X } from 'lucide-react'

interface Channel { id: string; name: string }
interface Member { id: string; name: string }

type Step = 'channels' | 'manager' | 'schedule'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('channels')
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
  const [workspaceName, setWorkspaceName] = useState('')
  const [pendingChannelNames, setPendingChannelNames] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/workspace').then(r => r.json()).then(d => {
      setWorkspaceName(d.teamName ?? '')
      setBackfillDays(d.backfillDays ?? 30)
      setScheduleInterval(d.scheduleInterval ?? 'weekly')
      // Pre-fill existing config — will be matched against channel list once loaded
      if (d.channels?.length) {
        setPendingChannelNames(d.channels)
      }
    })
    fetch('/api/slack/channels').then(r => r.json()).then(d => setChannels(d.channels ?? []))
    fetch('/api/slack/users').then(r => r.json()).then(d => {
      setMembers(d.members ?? [])
    })
  }, [])

  // Once channels load, pre-select the ones already configured
  useEffect(() => {
    if (pendingChannelNames.length > 0 && channels.length > 0) {
      const pre = channels.filter(c => pendingChannelNames.includes(c.name))
      if (pre.length > 0) setSelected(pre)
      setPendingChannelNames([])
    }
  }, [channels, pendingChannelNames])

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

  const finish = async () => {
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
    router.push('/')
  }

  const steps = [
    { key: 'channels', label: 'Channels' },
    { key: 'manager', label: 'Manager' },
    { key: 'schedule', label: 'Schedule' },
  ] as const

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {workspaceName ? `Setting up ${workspaceName}` : 'Setup'}
        </span>
      </header>

      <main style={{ maxWidth: 520, margin: '48px auto', padding: '0 24px' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
          {steps.map((s, i) => {
            const currentIdx = steps.findIndex(x => x.key === step)
            const isCurrent = step === s.key
            const isPast = i < currentIdx
            return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', border: '2px solid',
                  borderColor: isCurrent ? 'var(--amber)' : isPast ? 'var(--green)' : 'var(--border)',
                  background: isCurrent ? 'var(--amber)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  {isCurrent
                    ? <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                    : <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{i + 1}</span>}
                </div>
                <span style={{ fontSize: 11, color: isCurrent ? 'var(--amber)' : 'var(--text-dim)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ height: 1, background: 'var(--border)', flex: 0, width: 40, marginBottom: 16 }} />
              )}
            </div>
            )
          })}
        </div>

        {/* Step: Channels */}
        {step === 'channels' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              Which channels to monitor?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)', marginBottom: 24, lineHeight: 1.6 }}>
              Pick the channels where work happens — engineering standups, project channels, etc.
            </p>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {selected.map(ch => (
                  <div key={ch.id} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'var(--amber-light)', border: '1px solid var(--amber)',
                    borderRadius: 20, padding: '3px 10px 3px 10px',
                    fontSize: 12, color: 'var(--amber)', fontFamily: 'var(--font-mono)',
                  }}>
                    #{ch.name}
                    <button onClick={() => toggleChannel(ch)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--amber)' }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Channel picker */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
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
                      style={{ padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: 'var(--text-dim)' }}>#</span>{ch.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setStep('manager')}
              disabled={selected.length === 0}
              style={{
                padding: '11px 28px', borderRadius: 8, border: 'none',
                background: selected.length > 0 ? 'var(--text)' : 'var(--border)',
                color: selected.length > 0 ? 'var(--bg)' : 'var(--text-dim)',
                fontSize: 14, fontFamily: 'var(--font-jakarta)', fontWeight: 600,
                cursor: selected.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step: Manager */}
        {step === 'manager' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              Who receives the digest?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)', marginBottom: 24, lineHeight: 1.6 }}>
              The digest will be sent as a Slack DM to this person after each run.
            </p>

            {manager && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                background: 'var(--amber-light)', border: '1px solid var(--amber)',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <span style={{ fontSize: 13, color: 'var(--amber)', fontFamily: 'var(--font-jakarta)', fontWeight: 600 }}>{manager.name}</span>
                <button onClick={() => setManager(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--amber)', marginLeft: 'auto' }}>
                  <X size={13} />
                </button>
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: 24 }}>
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
                      style={{ padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-jakarta)', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
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

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep('channels')}
                style={{
                  padding: '11px 20px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: 14, fontFamily: 'var(--font-jakarta)',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('schedule')}
                disabled={!manager}
                style={{
                  padding: '11px 28px', borderRadius: 8, border: 'none',
                  background: manager ? 'var(--text)' : 'var(--border)',
                  color: manager ? 'var(--bg)' : 'var(--text-dim)',
                  fontSize: 14, fontFamily: 'var(--font-jakarta)', fontWeight: 600,
                  cursor: manager ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Schedule */}
        {step === 'schedule' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              Set up your digest schedule
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)', marginBottom: 32, lineHeight: 1.6 }}>
              We'll backfill historical messages once, then run digests automatically.
            </p>

            {/* Backfill */}
            <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              How far back to backfill?
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              {[30, 60, 90, 180].map(n => (
                <button key={n} onClick={() => setBackfillDays(n)} style={{
                  padding: '9px 18px', borderRadius: 8,
                  border: `1px solid ${backfillDays === n ? 'var(--amber)' : 'var(--border)'}`,
                  background: backfillDays === n ? 'var(--amber-light)' : 'var(--surface)',
                  color: backfillDays === n ? 'var(--amber)' : 'var(--text-muted)',
                  fontSize: 13, fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', transition: 'all 0.15s', fontWeight: backfillDays === n ? 600 : 400,
                }}>
                  {n}d
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
              <input
                type="number" min={1} max={730} value={backfillDays}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > 0) setBackfillDays(v) }}
                style={{
                  width: 80, padding: '9px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-mono)',
                  outline: 'none', textAlign: 'center',
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>custom days</span>
            </div>

            {/* Schedule interval */}
            <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              How often to run?
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}>
              {[
                { label: 'Daily', value: 'daily' },
                { label: 'Weekly', value: 'weekly' },
                { label: 'Biweekly', value: 'biweekly' },
                { label: 'Monthly', value: 'monthly' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setScheduleInterval(opt.value)} style={{
                  padding: '9px 18px', borderRadius: 8,
                  border: `1px solid ${scheduleInterval === opt.value ? 'var(--amber)' : 'var(--border)'}`,
                  background: scheduleInterval === opt.value ? 'var(--amber-light)' : 'var(--surface)',
                  color: scheduleInterval === opt.value ? 'var(--amber)' : 'var(--text-muted)',
                  fontSize: 13, fontFamily: 'var(--font-jakarta)',
                  cursor: 'pointer', transition: 'all 0.15s', fontWeight: scheduleInterval === opt.value ? 600 : 400,
                }}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Summary */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '16px 20px', marginBottom: 28,
              fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)',
              lineHeight: 1.8,
            }}>
              <div><span style={{ color: 'var(--text-dim)' }}>Workspace </span>{workspaceName}</div>
              <div><span style={{ color: 'var(--text-dim)' }}>Channels  </span>{selected.map(c => `#${c.name}`).join(', ')}</div>
              <div><span style={{ color: 'var(--text-dim)' }}>Manager   </span>{manager?.name}</div>
              <div><span style={{ color: 'var(--text-dim)' }}>Backfill  </span>{backfillDays} days</div>
              <div><span style={{ color: 'var(--text-dim)' }}>Schedule  </span>{scheduleInterval}</div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep('manager')}
                style={{
                  padding: '11px 20px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: 14, fontFamily: 'var(--font-jakarta)',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={finish}
                disabled={saving}
                style={{
                  padding: '11px 28px', borderRadius: 8, border: 'none',
                  background: 'var(--amber)', color: '#fff',
                  fontSize: 14, fontFamily: 'var(--font-jakarta)', fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1, transition: 'all 0.15s',
                }}
              >
                {saving ? 'Saving…' : 'Go to dashboard →'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
