import json
import os
import libsql_experimental as libsql

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
            person       TEXT,
            item         TEXT,
            message_date TEXT
        );
        CREATE TABLE IF NOT EXISTS decisions (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            digest_id INTEGER REFERENCES digests(id),
            decision  TEXT,
            channel   TEXT DEFAULT ''
        );
    """)
    # Migrate existing tables to add new columns if missing
    for alter in [
        "ALTER TABLE workspaces ADD COLUMN backfill_days INTEGER DEFAULT 30",
        "ALTER TABLE workspaces ADD COLUMN schedule_interval TEXT DEFAULT 'weekly'",
        "ALTER TABLE workspaces ADD COLUMN last_run_at TEXT DEFAULT NULL",
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
    }


def save_digest(digest: dict, lookback_days: int, total_messages: int, workspace_id: str | None = None) -> int:
    init_db()
    conn = _conn()

    cur = conn.execute(
        "INSERT INTO digests (lookback_days, period_summary, total_messages, raw_json, workspace_id) VALUES (?,?,?,?,?)",
        (lookback_days, digest.get("period_summary", ""), total_messages, json.dumps(digest), workspace_id),
    )
    conn.commit()
    did = cur.lastrowid

    ws_filter = "AND d.workspace_id=?" if workspace_id else "AND d.workspace_id IS NULL"
    ws_args = (workspace_id,) if workspace_id else ()

    for item in digest.get("action_items", []):
        existing = conn.execute(
            f"SELECT 1 FROM action_items ai JOIN digests d ON d.id=ai.digest_id WHERE ai.task=? AND ai.owner=? {ws_filter} LIMIT 1",
            (item["task"], item["owner"]) + ws_args,
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO action_items (digest_id, owner, task, deadline, channel) VALUES (?,?,?,?,?)",
                (did, item["owner"], item["task"], item.get("deadline", "unspecified"), item["channel"]),
            )

    for b in digest.get("blockers", []):
        existing = conn.execute(
            f"SELECT 1 FROM blockers bl JOIN digests d ON d.id=bl.digest_id WHERE bl.description=? {ws_filter} LIMIT 1",
            (b["description"],) + ws_args,
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO blockers (digest_id, description, affected, channel, message_date) VALUES (?,?,?,?,?)",
                (did, b["description"], b["affected"], b["channel"], b.get("date")),
            )

    for c in digest.get("contributions", []):
        existing = conn.execute(
            f"SELECT 1 FROM contributions cn JOIN digests d ON d.id=cn.digest_id WHERE cn.person=? AND cn.item=? {ws_filter} LIMIT 1",
            (c["person"], c["item"]) + ws_args,
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO contributions (digest_id, person, item, message_date) VALUES (?,?,?,?)",
                (did, c["person"], c["item"], c.get("date")),
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
                    "INSERT INTO decisions (digest_id, decision, channel) VALUES (?,?,?)",
                    (did, d["decision"], d.get("channel", "")),
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
