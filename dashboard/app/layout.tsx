import type { Metadata } from 'next'
import { Libre_Baskerville, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const baskerville = Libre_Baskerville({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-serif', display: 'swap' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'Team Digest',
  description: 'Slack team activity dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${baskerville.variable} ${jakarta.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
