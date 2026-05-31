import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — Rundown' }

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '60px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        <Link href="/" style={{
          fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-jakarta)',
          textDecoration: 'none', display: 'inline-block', marginBottom: 40,
        }}>
          ← Rundown
        </Link>

        <div style={{
          fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 28,
          color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8,
        }}>
          Privacy Policy
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 48 }}>
          Last updated: May 30, 2025
        </p>

        <Section title="Overview">
          Rundown is a Slack digest tool that summarizes your team&apos;s activity across Slack and GitHub
          and delivers a concise report to a designated manager. We take privacy seriously and collect
          only what is necessary to provide the service.
        </Section>

        <Section title="What we collect">
          <ul style={{ paddingLeft: 20, margin: 0, lineHeight: 2 }}>
            <li>Slack workspace ID and the channels you authorize us to read</li>
            <li>Slack user IDs and display names (to attribute contributions)</li>
            <li>Message content from selected channels, used solely to generate your digest</li>
            <li>GitHub repository metadata (PR titles, authors, merge dates) if you connect a repo</li>
          </ul>
        </Section>

        <Section title="What we don't do">
          <ul style={{ paddingLeft: 20, margin: 0, lineHeight: 2 }}>
            <li>We do not sell, rent, or share your data with third parties</li>
            <li>We do not store raw message content after the digest is generated</li>
            <li>We do not use your data to train AI models</li>
            <li>We do not send marketing emails</li>
          </ul>
        </Section>

        <Section title="Data storage">
          Digest summaries (action items, blockers, decisions, contributor counts) are stored in a
          private database to power the dashboard. Workspace configuration (channel list, manager ID)
          is stored to enable scheduled digests. You can delete your workspace data at any time by
          disconnecting the app from your Slack workspace.
        </Section>

        <Section title="Third-party services">
          Rundown uses the following services to operate:
          <ul style={{ paddingLeft: 20, margin: '8px 0 0', lineHeight: 2 }}>
            <li><strong>Slack API</strong> — to read messages and send digests</li>
            <li><strong>GitHub API</strong> — to fetch pull request data (optional)</li>
            <li><strong>OpenRouter / Anthropic</strong> — to summarize channel content via LLM</li>
            <li><strong>Turso</strong> — database hosting</li>
          </ul>
          Each service has its own privacy policy. Data sent to LLM providers is used only to generate
          your digest and is subject to their zero-data-retention policies where available.
        </Section>

        <Section title="Contact">
          Questions or data deletion requests:{' '}
          <a href="mailto:prakhar4@stanford.edu" style={{ color: 'var(--amber)', textDecoration: 'none' }}>
            prakhar4@stanford.edu
          </a>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{
        fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 16,
        color: 'var(--text)', marginBottom: 10,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-jakarta)',
        lineHeight: 1.8,
      }}>
        {children}
      </div>
    </div>
  )
}
