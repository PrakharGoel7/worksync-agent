'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader } from 'lucide-react'

interface Props {
  recipient: string
  context: string        // blocker description or task name shown for reference
  userId?: string        // Slack user ID — skips name search if provided
  onClose: () => void
}

export default function MessageModal({ recipient, context, userId, onClose }: Props) {
  const [message, setMessage] = useState(`Re: ${context}`)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<'sent' | 'error' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/slack/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personName: recipient, message: message.trim(), userId }),
      })
      const json = await res.json()
      if (res.ok) {
        setResult('sent')
        setTimeout(onClose, 1200)
      } else {
        setErrorMsg(json.error ?? 'Failed to send')
        setResult('error')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '24px 28px',
            width: 480,
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 15 }}>
                Message {recipient}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>
                via Slack DM
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={16} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          {/* Context pill */}
          <div style={{
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-muted)', marginBottom: 14,
            lineHeight: 1.4,
          }}>
            {context}
          </div>

          {/* Textarea */}
          <textarea
            autoFocus
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={`Write a message to ${recipient}…`}
            rows={4}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--bg)', color: 'var(--text)',
              fontSize: 13, fontFamily: 'var(--font-jakarta)',
              lineHeight: 1.5, resize: 'vertical', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            ⌘↵ to send
          </div>

          {/* Result states */}
          {result === 'sent' && (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--green)', textAlign: 'center' }}>
              ✓ Message sent
            </div>
          )}
          {result === 'error' && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--red)' }}>
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{
              padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'transparent', cursor: 'pointer', fontSize: 13,
              color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)',
            }}>
              Cancel
            </button>
            <button onClick={send} disabled={sending || !message.trim()} style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: sending || !message.trim() ? 'var(--amber-light)' : 'var(--amber)',
              color: sending || !message.trim() ? 'var(--amber)' : '#fff',
              cursor: sending || !message.trim() ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-jakarta)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {sending ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              Send
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
