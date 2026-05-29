import { createClient } from '@libsql/client'
import '@/lib/env' // ensures parent .env is loaded before DB client initializes

const client = createClient({
  url: process.env.TURSO_URL ?? 'file:../digests.db',
  authToken: process.env.TURSO_TOKEN,
})

export interface Workspace {
  id: string
  teamName: string
  botToken: string
  authedUserId: string
  channels: string[]
  managerSlackId: string
  backfillDays: number
  scheduleInterval: string
  lastRunAt: string | null
  model: string
  createdAt: string
}

// Run once at module load — all exported functions await this
const initPromise: Promise<void> = (async () => {
  await client.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS workspaces (
        id                TEXT PRIMARY KEY,
        team_name         TEXT NOT NULL,
        bot_token         TEXT NOT NULL,
        authed_user_id    TEXT DEFAULT '',
        channels          TEXT DEFAULT '[]',
        manager_slack_id  TEXT DEFAULT '',
        backfill_days     INTEGER DEFAULT 30,
        schedule_interval TEXT DEFAULT 'weekly',
        last_run_at       TEXT DEFAULT NULL,
        model             TEXT DEFAULT 'anthropic/claude-sonnet-4-5',
        created_at        TEXT DEFAULT CURRENT_TIMESTAMP
      )`, args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS digests (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lookback_days  INTEGER,
        period_summary TEXT,
        total_messages INTEGER DEFAULT 0,
        raw_json       TEXT,
        workspace_id   TEXT
      )`, args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS action_items (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        digest_id INTEGER REFERENCES digests(id),
        owner     TEXT,
        task      TEXT,
        deadline  TEXT,
        channel   TEXT,
        status    TEXT DEFAULT 'open',
        owner_ids TEXT DEFAULT ''
      )`, args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS blockers (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        digest_id    INTEGER REFERENCES digests(id),
        description  TEXT,
        affected     TEXT,
        channel      TEXT,
        message_date TEXT,
        affected_ids TEXT DEFAULT '',
        status       TEXT DEFAULT 'open'
      )`, args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS contributions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        digest_id    INTEGER REFERENCES digests(id),
        person       TEXT,
        item         TEXT,
        message_date TEXT
      )`, args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS decisions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        digest_id     INTEGER REFERENCES digests(id),
        decision      TEXT,
        channel       TEXT DEFAULT '',
        read          INTEGER DEFAULT 0,
        decision_date TEXT DEFAULT NULL
      )`, args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS folders (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT,
        name         TEXT NOT NULL,
        color        TEXT DEFAULT '#f59e0b',
        created_at   TEXT DEFAULT CURRENT_TIMESTAMP
      )`, args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS folder_items (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL,
        item_id   INTEGER NOT NULL,
        UNIQUE(folder_id, item_type, item_id)
      )`, args: [],
    },
  ], 'write')
  // Migrations: add new columns if they don't exist yet
  for (const sql of [
    `ALTER TABLE blockers ADD COLUMN status TEXT DEFAULT 'open'`,
    `ALTER TABLE decisions ADD COLUMN read INTEGER DEFAULT 0`,
    `ALTER TABLE decisions ADD COLUMN decision_date TEXT DEFAULT NULL`,
    `ALTER TABLE folders ADD COLUMN color TEXT DEFAULT '#f59e0b'`,
  ]) {
    try { await client.execute({ sql, args: [] }) } catch { /* already exists */ }
  }
})()

function row(r: any, columns: string[]): any {
  return Object.fromEntries(columns.map((c, i) => [c, r[i]]))
}

function rows(result: Awaited<ReturnType<typeof client.execute>>): any[] {
  return result.rows.map(r => row(r, result.columns))
}

// ── Workspace CRUD ──────────────────────────────────────────────────────────

export async function getWorkspace(id: string): Promise<Workspace | null> {
  await initPromise
  const result = await client.execute({
    sql: 'SELECT * FROM workspaces WHERE id = ?',
    args: [id],
  })
  if (!result.rows.length) return null
  const r = row(result.rows[0], result.columns)
  return {
    id: r.id,
    teamName: r.team_name,
    botToken: r.bot_token,
    authedUserId: r.authed_user_id,
    channels: JSON.parse(r.channels ?? '[]'),
    managerSlackId: r.manager_slack_id,
    backfillDays: r.backfill_days ?? 30,
    scheduleInterval: r.schedule_interval ?? 'weekly',
    lastRunAt: r.last_run_at ?? null,
    model: r.model,
    createdAt: r.created_at,
  }
}

export async function saveWorkspace(w: {
  id: string; teamName: string; botToken: string; authedUserId: string
}) {
  await initPromise
  await client.execute({
    sql: `INSERT INTO workspaces (id, team_name, bot_token, authed_user_id)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            team_name      = excluded.team_name,
            bot_token      = excluded.bot_token,
            authed_user_id = excluded.authed_user_id`,
    args: [w.id, w.teamName, w.botToken, w.authedUserId],
  })
}

export async function updateWorkspaceConfig(id: string, data: {
  channels?: string[]; managerSlackId?: string; backfillDays?: number; scheduleInterval?: string; lastRunAt?: string; model?: string
}) {
  await initPromise
  const fields: string[] = []
  const vals: any[] = []
  if (data.channels !== undefined) { fields.push('channels = ?'); vals.push(JSON.stringify(data.channels)) }
  if (data.managerSlackId !== undefined) { fields.push('manager_slack_id = ?'); vals.push(data.managerSlackId) }
  if (data.backfillDays !== undefined) { fields.push('backfill_days = ?'); vals.push(data.backfillDays) }
  if (data.scheduleInterval !== undefined) { fields.push('schedule_interval = ?'); vals.push(data.scheduleInterval) }
  if (data.lastRunAt !== undefined) { fields.push('last_run_at = ?'); vals.push(data.lastRunAt) }
  if (data.model !== undefined) { fields.push('model = ?'); vals.push(data.model) }
  if (!fields.length) return
  vals.push(id)
  await client.execute({ sql: `UPDATE workspaces SET ${fields.join(', ')} WHERE id = ?`, args: vals })
}

// ── Dashboard data ──────────────────────────────────────────────────────────

function weekLabel(iso: string): string {
  const d = new Date(iso)
  const s = new Date(d)
  s.setDate(d.getDate() - d.getDay())
  return s.toISOString().slice(0, 10)
}

function parsePeriodSummary(raw: string | null): string[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {}
  // fallback for old plain-text summaries: split into sentences
  return raw.split(/\.\s+/).filter(Boolean).map(s => s.endsWith('.') ? s : s + '.')
}

export async function getDashboardData(workspaceId?: string, channel?: string) {
  await initPromise
  const wsFilter = workspaceId ? 'AND d.workspace_id = ?' : ''
  const p = (base: any[]) => workspaceId ? [...base, workspaceId] : base
  // For queries with both workspace and channel filters, workspace ? must come first
  const pch = (extra: any[]) => workspaceId ? [workspaceId, ...extra] : extra
  const chFilter = channel ? "AND REPLACE(ai.channel, '#', '') = ?" : ''
  const chFilterB = channel ? "AND REPLACE(b.channel, '#', '') = ?" : ''
  const chFilterD = channel ? "AND REPLACE(dec.channel, '#', '') = ?" : ''
  const chArgs = channel ? [channel.replace(/^#/, '')] : []
  const mcChFilter = channel ? 'AND mc.channel = ?' : ''
  const mcChArgs = channel ? [channel] : []

  const where = `WHERE 1=1 ${wsFilter}`
  const [totMsg, openAI, actBlk, actCtrib, totDig, latestRow, aiRows, blkRows, decRows, ctribRows, channelRows] =
    await Promise.all([
      client.execute({ sql: `SELECT COALESCE(SUM(total_messages),0) AS v FROM digests d ${where}`, args: p([]) }),
      client.execute({ sql: `SELECT COUNT(*) AS v FROM action_items ai JOIN digests d ON d.id = ai.digest_id ${where} AND ai.status = 'open' ${chFilter}`, args: pch(chArgs) }),
      client.execute({ sql: `SELECT COUNT(*) AS v FROM blockers b JOIN digests d ON d.id = b.digest_id ${where} AND (b.status IS NULL OR b.status = 'open') ${chFilterB}`, args: pch(chArgs) }),
      client.execute({ sql: `SELECT COUNT(DISTINCT person) AS v FROM message_counts mc WHERE mc.workspace_id = ? ${mcChFilter}`, args: [workspaceId ?? '', ...mcChArgs] }),
      client.execute({ sql: `SELECT COUNT(*) AS v FROM digests d ${where}`, args: p([]) }),
      client.execute({ sql: `SELECT period_summary, created_at FROM digests d ${where} ORDER BY d.created_at DESC LIMIT 1`, args: p([]) }),
      client.execute({ sql: `SELECT ai.id, ai.owner, ai.owner_ids AS ownerIds, ai.task, ai.deadline, ai.channel, ai.status, d.created_at AS createdAt FROM action_items ai JOIN digests d ON d.id = ai.digest_id ${where} ${chFilter} ORDER BY d.created_at DESC`, args: pch(chArgs) }),
      client.execute({ sql: `SELECT b.id, b.description, b.affected, b.affected_ids AS affectedIds, b.channel, COALESCE(b.message_date, d.created_at) AS messageDate, COALESCE(b.status, 'open') AS status FROM blockers b JOIN digests d ON d.id = b.digest_id ${where} ${chFilterB} ORDER BY b.message_date DESC, d.created_at DESC`, args: pch(chArgs) }),
      client.execute({ sql: `SELECT dec.id, dec.decision, dec.channel, COALESCE(dec.decision_date, d.created_at) AS createdAt, COALESCE(dec.read, 0) AS read FROM decisions dec JOIN digests d ON d.id = dec.digest_id ${where} ${chFilterD} ORDER BY d.created_at DESC`, args: pch(chArgs) }),
      client.execute({ sql: `SELECT mc.person, mc.message_date AS msgDate, mc.count FROM message_counts mc WHERE mc.workspace_id = ? ${mcChFilter} ORDER BY mc.message_date ASC`, args: [workspaceId ?? '', ...mcChArgs] }),
      client.execute({ sql: `SELECT DISTINCT mc.channel FROM message_counts mc WHERE mc.workspace_id = ? ORDER BY mc.channel ASC`, args: [workspaceId ?? ''] }),
    ])

  const latest = latestRow.rows[0] ? row(latestRow.rows[0], latestRow.columns) : null
  const weekMap: Record<string, Record<string, number>> = {}
  for (const r of rows(ctribRows)) {
    const wk = weekLabel(r.msgDate)
    weekMap[wk] ??= {}
    weekMap[wk][r.person] = (weekMap[wk][r.person] ?? 0) + Number(r.count ?? 1)
  }

  return {
    stats: {
      totalMessages: Number(rows(totMsg)[0]?.v ?? 0),
      openActionItems: Number(rows(openAI)[0]?.v ?? 0),
      activeBlockers: Number(rows(actBlk)[0]?.v ?? 0),
      activeContributors: Number(rows(actCtrib)[0]?.v ?? 0),
      totalDigests: Number(rows(totDig)[0]?.v ?? 0),
    },
    periodSummary: parsePeriodSummary(latest?.period_summary ?? null),
    actionItems: rows(aiRows),
    actionItemOwners: [...new Set(
      rows(aiRows).flatMap(i => (i.owner ?? '').split(',').map((n: string) => n.trim()).filter(Boolean))
    )].sort(),
    blockers: rows(blkRows),
    decisions: rows(decRows),
    contributionsByDigest: Object.entries(weekMap).map(([date, pp]) => ({ date, ...pp })),
    channels: rows(channelRows).map((r: any) => String(r.channel)).filter(Boolean),
  }
}

// ── Scoped list queries ─────────────────────────────────────────────────────

export async function getAllActionItems(workspaceId?: string) {
  await initPromise
  const wsFilter = workspaceId ? 'AND d.workspace_id = ?' : ''
  const args = workspaceId ? [workspaceId] : []
  const result = await client.execute({
    sql: `SELECT ai.id, ai.owner, ai.owner_ids AS ownerIds, ai.task, ai.deadline, ai.channel, ai.status, d.created_at AS createdAt
          FROM action_items ai JOIN digests d ON d.id = ai.digest_id
          WHERE 1=1 ${wsFilter} ORDER BY d.created_at DESC`,
    args,
  })
  return rows(result)
}

export async function getAllBlockers(workspaceId?: string) {
  await initPromise
  const wsFilter = workspaceId ? 'AND d.workspace_id = ?' : ''
  const args = workspaceId ? [workspaceId] : []
  const result = await client.execute({
    sql: `SELECT b.id, b.description, b.affected, b.affected_ids AS affectedIds, b.channel,
                 COALESCE(b.message_date, d.created_at) AS messageDate, COALESCE(b.status, 'open') AS status
          FROM blockers b JOIN digests d ON d.id = b.digest_id
          WHERE 1=1 ${wsFilter} ORDER BY b.message_date DESC, d.created_at DESC`,
    args,
  })
  return rows(result)
}

export async function getAllDecisions(workspaceId?: string) {
  await initPromise
  const wsFilter = workspaceId ? 'AND d.workspace_id = ?' : ''
  const args = workspaceId ? [workspaceId] : []
  const result = await client.execute({
    sql: `SELECT dec.id, dec.decision, dec.channel, d.created_at AS createdAt, COALESCE(dec.read, 0) AS read
          FROM decisions dec JOIN digests d ON d.id = dec.digest_id
          WHERE 1=1 ${wsFilter} ORDER BY d.created_at DESC`,
    args,
  })
  return rows(result)
}

// ── Mutation helpers ────────────────────────────────────────────────────────

export async function setActionItemStatus(id: number, status: string) {
  await initPromise
  await client.execute({ sql: 'UPDATE action_items SET status = ? WHERE id = ?', args: [status, id] })
}

export async function updateActionItemOwner(id: number, owner: string, ownerIds: string) {
  await initPromise
  await client.execute({ sql: 'UPDATE action_items SET owner = ?, owner_ids = ? WHERE id = ?', args: [owner, ownerIds, id] })
}

export async function updateActionItemDeadline(id: number, deadline: string) {
  await initPromise
  await client.execute({ sql: 'UPDATE action_items SET deadline = ? WHERE id = ?', args: [deadline, id] })
}

export async function deleteActionItem(id: number) {
  await initPromise
  await client.execute({ sql: 'DELETE FROM action_items WHERE id = ?', args: [id] })
}

export async function setBlockerStatus(id: number, status: string) {
  await initPromise
  await client.execute({ sql: 'UPDATE blockers SET status = ? WHERE id = ?', args: [status, id] })
}

export async function updateBlocker(id: number, affected: string, affectedIds: string) {
  await initPromise
  await client.execute({ sql: 'UPDATE blockers SET affected = ?, affected_ids = ? WHERE id = ?', args: [affected, affectedIds, id] })
}

export async function deleteBlocker(id: number) {
  await initPromise
  await client.execute({ sql: 'DELETE FROM blockers WHERE id = ?', args: [id] })
}

export async function setDecisionRead(id: number, read: boolean) {
  await initPromise
  await client.execute({ sql: 'UPDATE decisions SET read = ? WHERE id = ?', args: [read ? 1 : 0, id] })
}

export async function markAllDecisionsRead(workspaceId?: string) {
  await initPromise
  const wsFilter = workspaceId ? 'AND d.workspace_id = ?' : ''
  const args = workspaceId ? [workspaceId] : []
  await client.execute({
    sql: `UPDATE decisions SET read = 1 WHERE id IN (SELECT dec.id FROM decisions dec JOIN digests d ON d.id = dec.digest_id WHERE 1=1 ${wsFilter})`,
    args,
  })
}

export async function deleteDecision(id: number) {
  await initPromise
  await client.execute({ sql: 'DELETE FROM decisions WHERE id = ?', args: [id] })
}

// ── Contribution detail query ────────────────────────────────────────────────

export async function getContributionDetails(workspaceId?: string, channel?: string) {
  await initPromise
  const wsFilter = workspaceId ? 'AND d.workspace_id = ?' : ''
  const p = workspaceId ? [workspaceId] : []
  const channelFilter = channel ? 'AND mc.channel = ?' : ''
  const mcArgs: any[] = [workspaceId ?? '', ...(channel ? [channel] : [])]

  const [ctribRows, channelRows, aiRows, blkRows] = await Promise.all([
    client.execute({
      sql: `SELECT mc.person, mc.message_date AS msgDate, mc.count
            FROM message_counts mc
            WHERE mc.workspace_id = ? ${channelFilter} ORDER BY mc.message_date ASC`,
      args: mcArgs,
    }),
    client.execute({
      sql: `SELECT DISTINCT mc.channel FROM message_counts mc WHERE mc.workspace_id = ? ORDER BY mc.channel ASC`,
      args: [workspaceId ?? ''],
    }),
    client.execute({
      sql: `SELECT ai.id, ai.owner, ai.owner_ids AS ownerIds, ai.task, ai.deadline, ai.channel, ai.status
            FROM action_items ai JOIN digests d ON d.id = ai.digest_id
            WHERE 1=1 ${wsFilter} AND ai.status = 'open'`,
      args: p,
    }),
    client.execute({
      sql: `SELECT b.id, b.description, b.affected, b.channel, COALESCE(b.status, 'open') AS status
            FROM blockers b JOIN digests d ON d.id = b.digest_id
            WHERE 1=1 ${wsFilter} AND (b.status IS NULL OR b.status = 'open')`,
      args: p,
    }),
  ])

  const allContribs = rows(ctribRows)
  const channels = rows(channelRows).map((r: any) => String(r.channel)).filter(Boolean)
  const allAI = rows(aiRows)
  const allBlockers = rows(blkRows)

  const now = new Date()
  const cutoff14 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10)
  const cutoff28 = new Date(now.getTime() - 28 * 86400000).toISOString().slice(0, 10)

  const weekMap: Record<string, Record<string, number>> = {}
  const personTotals: Record<string, number> = {}
  const personRecent: Record<string, number> = {}
  const personPrior: Record<string, number> = {}
  const personByWeek: Record<string, Record<string, number>> = {}

  for (const r of allContribs) {
    const wk = weekLabel(r.msgDate)
    const cnt = Number(r.count ?? 1)
    weekMap[wk] ??= {}
    weekMap[wk][r.person] = (weekMap[wk][r.person] ?? 0) + cnt
    personTotals[r.person] = (personTotals[r.person] ?? 0) + cnt
    const d = String(r.msgDate).slice(0, 10)
    if (d >= cutoff14) personRecent[r.person] = (personRecent[r.person] ?? 0) + cnt
    else if (d >= cutoff28) personPrior[r.person] = (personPrior[r.person] ?? 0) + cnt
    personByWeek[r.person] ??= {}
    personByWeek[r.person][wk] = (personByWeek[r.person][wk] ?? 0) + cnt
  }

  const personAI: Record<string, any[]> = {}
  const personSlackId: Record<string, string> = {}
  for (const ai of allAI) {
    const names = (ai.owner ?? '').split(',').map((n: string) => n.trim()).filter(Boolean)
    const ids = (ai.ownerIds ?? '').split(',').map((n: string) => n.trim()).filter(Boolean)
    names.forEach((name: string, i: number) => {
      personAI[name] ??= []
      personAI[name].push(ai)
      if (ids[i] && !personSlackId[name]) personSlackId[name] = ids[i]
    })
  }

  const personBlockers: Record<string, any[]> = {}
  for (const b of allBlockers) {
    for (const name of (b.affected ?? '').split(',').map((n: string) => n.trim()).filter(Boolean)) {
      personBlockers[name] ??= []
      personBlockers[name].push(b)
    }
  }

  const contributors = Object.entries(personTotals)
    .map(([name, total]) => ({
      name,
      total,
      recent: personRecent[name] ?? 0,
      prior: personPrior[name] ?? 0,
      openActionItems: (personAI[name] ?? []).length,
      openBlockers: (personBlockers[name] ?? []).length,
    }))
    .sort((a, b) => b.total - a.total)

  const personDetails: Record<string, {
    actionItems: any[]
    blockers: any[]
    byWeek: Array<{ date: string; count: number }>
  }> = {}

  for (const { name } of contributors) {
    personDetails[name] = {
      actionItems: personAI[name] ?? [],
      blockers: personBlockers[name] ?? [],
      byWeek: Object.entries(personByWeek[name] ?? {})
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }
  }

  return {
    allByWeek: Object.entries(weekMap)
      .map(([date, pp]) => ({ date, ...pp }))
      .sort((a, b) => (a.date as string).localeCompare(b.date as string)),
    contributors,
    personDetails,
    teamId: workspaceId ?? null,
    personSlackId,
    channels,
  }
}

// ── Folder helpers ──────────────────────────────────────────────────────────

export async function getFolders(workspaceId?: string): Promise<{ id: number; name: string; color: string }[]> {
  await initPromise
  const wsFilter = workspaceId ? 'WHERE workspace_id = ?' : ''
  const args = workspaceId ? [workspaceId] : []
  const result = await client.execute({ sql: `SELECT id, name, color FROM folders ${wsFilter} ORDER BY id ASC`, args })
  return rows(result).map(r => ({ id: Number(r.id), name: String(r.name), color: String(r.color ?? '#f59e0b') }))
}

export async function getFolderItems(workspaceId?: string): Promise<{ folderId: number; itemType: string; itemId: number }[]> {
  await initPromise
  const wsFilter = workspaceId ? 'WHERE f.workspace_id = ?' : ''
  const args = workspaceId ? [workspaceId] : []
  const result = await client.execute({
    sql: `SELECT fi.folder_id, fi.item_type, fi.item_id FROM folder_items fi JOIN folders f ON f.id = fi.folder_id ${wsFilter}`,
    args,
  })
  return rows(result).map(r => ({ folderId: Number(r.folder_id), itemType: String(r.item_type), itemId: Number(r.item_id) }))
}

export async function createFolder(name: string, color: string, workspaceId?: string): Promise<number> {
  await initPromise
  const result = await client.execute({
    sql: 'INSERT INTO folders (name, color, workspace_id) VALUES (?, ?, ?) RETURNING id',
    args: [name, color, workspaceId ?? null],
  })
  return Number(rows(result)[0].id)
}

export async function deleteFolder(id: number): Promise<void> {
  await initPromise
  await client.execute({ sql: 'DELETE FROM folders WHERE id = ?', args: [id] })
}

export async function addItemToFolder(folderId: number, itemType: string, itemId: number): Promise<void> {
  await initPromise
  await client.execute({
    sql: 'INSERT OR IGNORE INTO folder_items (folder_id, item_type, item_id) VALUES (?, ?, ?)',
    args: [folderId, itemType, itemId],
  })
}

export async function removeItemFromFolder(folderId: number, itemType: string, itemId: number): Promise<void> {
  await initPromise
  await client.execute({
    sql: 'DELETE FROM folder_items WHERE folder_id = ? AND item_type = ? AND item_id = ?',
    args: [folderId, itemType, itemId],
  })
}
