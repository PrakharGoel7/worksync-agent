import fs from 'fs'
import path from 'path'

function loadParentEnv() {
  const envPath = path.join(process.cwd(), '..', '.env')
  try {
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const m = line.match(/^([^=\s#][^=]*)=(.*)$/)
      if (m) process.env[m[1].trim()] ??= m[2].trim()
    }
  } catch {}
}

loadParentEnv()

export const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN ?? ''
export const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID ?? ''
export const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET ?? ''
