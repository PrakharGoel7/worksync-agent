'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Authorization was cancelled.',
  misconfigured: 'OAuth credentials are not configured.',
  slack_error: 'Slack returned an error. Please try again.',
}

function LoginContent() {
  const params = useSearchParams()
  const error = params.get('error')
  const [installed, setInstalled] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/auth/check')
      .then(r => r.json())
      .then(d => setInstalled(!!d.installed))
      .catch(() => setInstalled(false))
  }, [])

  const buttonLabel = installed ? 'Sign in with Slack' : 'Add to Slack'
  const subtitle = installed ? 'Welcome back' : 'Get started in minutes'

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
        {/* Logo / wordmark */}
        <div style={{
          fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 26,
          letterSpacing: '0.04em', color: 'var(--text)', marginBottom: 8,
        }}>
          WorkSync
        </div>
        <p style={{
          fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)',
          lineHeight: 1.6, marginBottom: 8,
        }}>
          Your Slack activity, distilled into a manager digest.
        </p>
        <p style={{
          fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-jakarta)',
          lineHeight: 1.6, marginBottom: 36,
          minHeight: 20,
        }}>
          {installed !== null ? subtitle : ''}
        </p>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 16px', marginBottom: 24,
            fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-jakarta)',
          }}>
            {ERROR_MESSAGES[error] ?? 'Something went wrong.'}
          </div>
        )}

        {/* Slack button */}
        <a
          href="/api/auth/connect"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: '#4A154B', color: '#fff',
            padding: '13px 24px', borderRadius: 8,
            textDecoration: 'none', fontFamily: 'var(--font-jakarta)',
            fontWeight: 600, fontSize: 15, transition: 'opacity 0.15s',
            opacity: installed === null ? 0.6 : 1,
            pointerEvents: installed === null ? 'none' : 'auto',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <SlackIcon />
          {installed === null ? '            ' : buttonLabel}
        </a>

        <p style={{
          marginTop: 28, fontSize: 12, color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', lineHeight: 1.6,
        }}>
          Requires channels:history · chat:write · users:read
        </p>
      </div>
    </div>
  )
}

function SlackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 54 54" fill="none">
      <path d="M19.7 31.9c0 2.8-2.3 5.1-5.1 5.1s-5.1-2.3-5.1-5.1 2.3-5.1 5.1-5.1h5.1v5.1z" fill="#E01E5A"/>
      <path d="M22.3 31.9c0-2.8 2.3-5.1 5.1-5.1s5.1 2.3 5.1 5.1v12.8c0 2.8-2.3 5.1-5.1 5.1s-5.1-2.3-5.1-5.1V31.9z" fill="#E01E5A"/>
      <path d="M27.4 19.7c-2.8 0-5.1-2.3-5.1-5.1s2.3-5.1 5.1-5.1 5.1 2.3 5.1 5.1v5.1h-5.1z" fill="#36C5F0"/>
      <path d="M27.4 22.3c2.8 0 5.1 2.3 5.1 5.1s-2.3 5.1-5.1 5.1H14.6c-2.8 0-5.1-2.3-5.1-5.1s2.3-5.1 5.1-5.1h12.8z" fill="#36C5F0"/>
      <path d="M39.6 27.4c0 2.8 2.3 5.1 5.1 5.1s5.1-2.3 5.1-5.1-2.3-5.1-5.1-5.1h-5.1v5.1z" fill="#2EB67D"/>
      <path d="M37 27.4c0-2.8-2.3-5.1-5.1-5.1s-5.1 2.3-5.1 5.1v12.8c0 2.8 2.3 5.1 5.1 5.1s5.1-2.3 5.1-5.1V27.4z" fill="#2EB67D"/>
      <path d="M31.9 39.6c2.8 0 5.1 2.3 5.1 5.1s-2.3 5.1-5.1 5.1-5.1-2.3-5.1-5.1v-5.1h5.1z" fill="#ECB22E"/>
      <path d="M31.9 37c-2.8 0-5.1-2.3-5.1-5.1s2.3-5.1 5.1-5.1h12.8c2.8 0 5.1 2.3 5.1 5.1s-2.3 5.1-5.1 5.1H31.9z" fill="#ECB22E"/>
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
