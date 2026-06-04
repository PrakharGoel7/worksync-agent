import json
import os
import libsql_experimental as libsql
from identity import SlackIdentityIndex

TURSO_URL = os.environ.get("TURSO_URL", "file:digests.db")
TURSO_TOKEN = os.environ.get("TURSO_TOKEN", "")

# libsql-experimental uses libsql:// prefix; convert if needed
_url = TURSO_URL.replace("libsql://", "https://") if TURSO_URL.startswith("libsql://") else TURSO_URL


def _conn():
    if _url.startswith("https://"):
        return libsql.connect(database=_url, auth_token=TURSO_TOKEN)
    return libsql.connect(database=_url)


def init_db() -> None:
    conn = _conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS workspaces (
            id                TEXT PRIMARY KEY,
            team_name         TEXT NOT NULL,
            bot_token         TEXT NOT NULL,
            authed_user_id    TEXT DEFAULT '',
            channels          TEXT DEFAULT '[]',
            manager_slack_id  TEXT DEFAULT '',
            lookback_days     INTEGER DEFAULT 7,
            backfill_days     INTEGER DEFAULT 30,
            schedule_interval TEXT DEFAULT 'weekly',
            last_run_at       TEXT DEFAULT NULL,
            model             TEXT DEFAULT 'anthropic/claude-sonnet-4-5',
            created_at        TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS digests (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            lookback_days  INTEGER,
            period_summary TEXT,
            total_messages INTEGER DEFAULT 0,
            raw_json       TEXT,
            workspace_id   TEXT
        );
        CREATE TABLE IF NOT EXISTS action_items (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            digest_id INTEGER REFERENCES digests(id),
            owner     TEXT,
            task      TEXT,
            deadline  TEXT,
            channel   TEXT,
            status    TEXT DEFAULT 'open',
            owner_ids TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS blockers (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            digest_id    INTEGER REFERENCES digests(id),
            description  TEXT,
            affected     TEXT,
            channel      TEXT,
            message_date TEXT,
            affected_ids TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS contributions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            digest_id    INTEGER REFERENCES digests(id),
            user_id      TEXT DEFAULT '',
            person       TEXT,
            item         TEXT,
            message_date TEXT
        );
        CREATE TABLE IF NOT EXISTS decisions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            digest_id     INTEGER REFERENCES digests(id),
            decision      TEXT,
            channel       TEXT DEFAULT '',
            decision_date TEXT DEFAULT NULL
        );
        CREATE TABLE IF NOT EXISTS message_counts (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id TEXT NOT NULL DEFAULT '',
            user_id      TEXT NOT NULL DEFAULT '',
            person       TEXT NOT NULL,
            channel      TEXT NOT NULL DEFAULT '',
            message_date TEXT NOT NULL,
            count        INTEGER NOT NULL DEFAULT 0,
            UNIQUE(workspace_id, person, channel, message_date)
        );
    """)
    # Migrate message_counts to add channel column if missing (recreate since constraint changes)
    try:
        conn.execute("SELECT channel FROM message_counts LIMIT 0")
    except Exception:
        conn.execute("DROP TABLE IF EXISTS message_counts")
        conn.execute("""
            CREATE TABLE message_counts (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id TEXT NOT NULL DEFAULT '',
                user_id      TEXT NOT NULL DEFAULT '',
                person       TEXT NOT NULL,
                channel      TEXT NOT NULL DEFAULT '',
                message_date TEXT NOT NULL,
                count        INTEGER NOT NULL DEFAULT 0,
                UNIQUE(workspace_id, person, channel, message_date)
            )
        """)

    # Migrate existing tables to add new columns if missing
    for alter in [
        "ALTER TABLE workspaces ADD COLUMN backfill_days INTEGER DEFAULT 30",
        "ALTER TABLE workspaces ADD COLUMN schedule_interval TEXT DEFAULT 'weekly'",
        "ALTER TABLE workspaces ADD COLUMN last_run_at TEXT DEFAULT NULL",
        "ALTER TABLE decisions ADD COLUMN decision_date TEXT DEFAULT NULL",
        "ALTER TABLE contributions ADD COLUMN user_id TEXT DEFAULT ''",
        "ALTER TABLE message_counts ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
    ]:
        try:
            conn.execute(alter)
        except Exception:
            pass
    conn.commit()


def load_workspace_config(workspace_id: str) -> dict | None:
    init_db()
    conn = _conn()
    cur = conn.execute("SELECT * FROM workspaces WHERE id=?", (workspace_id,))
    row = cur.fetchone()
    if not row:
        return None
    cols = [d[0] for d in cur.description]
    r = dict(zip(cols, row))
    return {
        "id": r["id"],
        "team_name": r["team_name"],
        "bot_token": r["bot_token"],
        "authed_user_id": r["authed_user_id"],
        "channels": json.loads(r["channels"] or "[]"),
        "manager_slack_id": r["manager_slack_id"],
        "lookback_days": r.get("lookback_days", 7),
        "backfill_days": r.get("backfill_days") or r.get("lookback_days") or 30,
        "schedule_interval": r.get("schedule_interval") or "weekly",
        "last_run_at": r.get("last_run_at"),
        "model": r["model"],
        "github_token": r.get("github_token"),
        "github_repos": r.get("github_repos"),
    }


def save_digest(
    digest: dict,
    lookback_days: int,
    total_messages: int,
    workspace_id: str | None = None,
    identities: SlackIdentityIndex | None = None,
) -> int:
    init_db()
    conn = _conn()

    period_summary = digest.get("period_summary", "")
    if isinstance(period_summary, list):
        period_summary = json.dumps(period_summary)

    cur = conn.execute(
        "INSERT INTO digests (lookback_days, period_summary, total_messages, raw_json, workspace_id) VALUES (?,?,?,?,?)",
        (lookback_days, period_summary, total_messages, json.dumps(digest), workspace_id),
    )
    conn.commit()
    did = cur.lastrowid

    ws_filter = "AND d.workspace_id=?" if workspace_id else "AND d.workspace_id IS NULL"
    ws_args = (workspace_id,) if workspace_id else ()

    for item in digest.get("action_items", []):
        owner, owner_ids = identities.canonicalize_many(item.get("owner")) if identities else (item["owner"], "")
        existing = conn.execute(
            f"""SELECT 1 FROM action_items ai JOIN digests d ON d.id=ai.digest_id
                WHERE ai.task=? AND (ai.owner_ids=? OR ai.owner=?) {ws_filter} LIMIT 1""",
            (item["task"], owner_ids, owner) + ws_args,
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO action_items (digest_id, owner, owner_ids, task, deadline, channel) VALUES (?,?,?,?,?,?)",
                (did, owner, owner_ids, item["task"], item.get("deadline", "unspecified"), item["channel"].lstrip('#')),
            )

    for b in digest.get("blockers", []):
        affected, affected_ids = identities.canonicalize_many(b.get("affected")) if identities else (b["affected"], "")
        existing = conn.execute(
            f"SELECT 1 FROM blockers bl JOIN digests d ON d.id=bl.digest_id WHERE bl.description=? {ws_filter} LIMIT 1",
            (b["description"],) + ws_args,
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO blockers (digest_id, description, affected, affected_ids, channel, message_date) VALUES (?,?,?,?,?,?)",
                (did, b["description"], affected, affected_ids, b["channel"].lstrip('#'), b.get("date")),
            )

    for c in digest.get("contributions", []):
        person_identity = identities.resolve_one(c.get("person")) if identities else None
        person = person_identity.name if person_identity else c["person"]
        user_id = person_identity.id if person_identity else ""
        existing = conn.execute(
            f"""SELECT 1 FROM contributions cn JOIN digests d ON d.id=cn.digest_id
                WHERE (cn.user_id=? OR cn.person=?) AND cn.item=? {ws_filter} LIMIT 1""",
            (user_id, person, c["item"]) + ws_args,
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO contributions (digest_id, user_id, person, item, message_date) VALUES (?,?,?,?,?)",
                (did, user_id, person, c["item"], c.get("date")),
            )

    for d in digest.get("decisions", []):
        text = d["decision"] if isinstance(d, dict) else d
        existing = conn.execute(
            f"SELECT 1 FROM decisions dv JOIN digests d ON d.id=dv.digest_id WHERE dv.decision=? {ws_filter} LIMIT 1",
            (text,) + ws_args,
        ).fetchone()
        if not existing:
            if isinstance(d, dict):
                conn.execute(
                    "INSERT INTO decisions (digest_id, decision, channel, decision_date) VALUES (?,?,?,?)",
                    (did, d["decision"], d.get("channel", "").lstrip('#'), d.get("date")),
                )
            else:
                conn.execute("INSERT INTO decisions (digest_id, decision) VALUES (?,?)", (did, d))

    conn.commit()
    return did


def get_all_workspaces() -> list[dict]:
    init_db()
    conn = _conn()
    cur = conn.execute(
        "SELECT id, channels, manager_slack_id, schedule_interval, last_run_at FROM workspaces"
    )
    cols = [d[0] for d in cur.description]
    results = []
    for row in cur.fetchall():
        r = dict(zip(cols, row))
        channels = json.loads(r.get("channels") or "[]")
        if channels and r.get("manager_slack_id"):
            results.append({
                "id": r["id"],
                "schedule_interval": r.get("schedule_interval") or "weekly",
                "last_run_at": r.get("last_run_at"),
            })
    return results


def update_last_run_at(workspace_id: str) -> None:
    from datetime import datetime, timezone
    init_db()
    conn = _conn()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("UPDATE workspaces SET last_run_at=? WHERE id=?", (now, workspace_id))
    conn.commit()


def save_message_counts(
    channel_data: dict,
    workspace_id: str | None = None,
    identities: SlackIdentityIndex | None = None,
) -> None:
    from datetime import datetime
    from collections import defaultdict
    init_db()
    conn = _conn()
    wid = workspace_id or ''
    identities = identities or SlackIdentityIndex.from_channel_data(channel_data)
    counts: dict[tuple[str, str, str, str], int] = defaultdict(int)
    for channel_name, msgs in channel_data.items():
        for msg in msgs:
            person = msg.get('user', 'unknown')
            user_id = msg.get('user_id', '')
            if user_id:
                resolved = identities.resolve_one(user_id)
                if resolved:
                    person = resolved.name
            date = datetime.fromtimestamp(float(msg['ts'])).strftime('%Y-%m-%d')
            counts[(user_id, person, channel_name, date)] += 1
            for reply in msg.get('replies', []):
                rp = reply.get('user', 'unknown')
                rid = reply.get('user_id', '')
                if rid:
                    resolved = identities.resolve_one(rid)
                    if resolved:
                        rp = resolved.name
                rd = datetime.fromtimestamp(float(reply['ts'])).strftime('%Y-%m-%d') if reply.get('ts') else date
                counts[(rid, rp, channel_name, rd)] += 1
    for (user_id, person, channel, date), count in counts.items():
        conn.execute(
            """INSERT INTO message_counts (workspace_id, user_id, person, channel, message_date, count)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(workspace_id, person, channel, message_date) DO UPDATE SET
                 user_id = excluded.user_id,
                 count = excluded.count""",
            (wid, user_id, person, channel, date, count),
        )
    conn.commit()
