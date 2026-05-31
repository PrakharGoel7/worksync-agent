'use client'
import { useEffect, useState } from 'react'
import { Play, RefreshCw, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'

interface Props {
  onRun: () => void
  running: boolean
}

export default function Header({ onRun, running }: Props) {
  const [teamName, setTeamName] = useState('')
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  useEffect(() => {
    fetch('/api/workspace').then(r => r.json()).then(d => setTeamName(d.teamName ?? '')).catch(() => {})
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout')
    window.location.href = '/login'
  }

  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      padding: '0 36px',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text)',
        }}>
          {teamName || 'Rundown'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {today}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onRun} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 14px',
          border: '1px solid var(--amber)',
          borderRadius: 6,
          cursor: running ? 'not-allowed' : 'pointer',
          background: running ? 'var(--amber-light)' : 'var(--amber)',
          color: running ? 'var(--amber)' : '#fff',
          fontSize: 12,
          fontWeight: 600,
          transition: 'all 0.15s',
          opacity: running ? 0.8 : 1,
        }}>
          {running
            ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
            : <Play size={11} />}
          {running ? 'Running…' : 'Run Digest'}
        </button>

        <Link
          href="/settings"
          title="Settings"
          style={{
            display: 'flex', alignItems: 'center',
            color: 'var(--text-dim)', borderRadius: 4,
            padding: 6, transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          <Settings size={14} />
        </Link>

        <button
          onClick={logout}
          title="Sign out"
          style={{
            display: 'flex', alignItems: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 6, color: 'var(--text-dim)', borderRadius: 4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
