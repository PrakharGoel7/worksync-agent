"""
Minimal HTTP server so Railway can expose the Python agent as a web service.
The Vercel dashboard calls POST /run?workspace=<id> to trigger a digest.
A background scheduler calls /cron every hour to auto-run scheduled digests.
"""

import os
import threading
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()

from config import Config
from main import run_digest
from storage import get_all_workspaces, update_last_run_at

app = Flask(__name__)

RUN_SECRET = os.environ.get("RUN_SECRET", "")

_lock = threading.Lock()
_running = False

INTERVAL_SECONDS = {
    "daily": 86400,
    "weekly": 604800,
    "biweekly": 1209600,
    "monthly": 2592000,
}


@app.route("/health")
def health():
    return jsonify({"ok": True})


@app.route("/status")
def status():
    return jsonify({"running": _running})


@app.route("/run", methods=["POST"])
def run():
    global _running
    if RUN_SECRET and request.headers.get("X-Run-Secret") != RUN_SECRET:
        return jsonify({"error": "Unauthorized"}), 401

    workspace_id = request.args.get("workspace")

    if not _lock.acquire(blocking=False):
        return jsonify({"error": "A digest is already running"}), 409

    _running = True
    try:
        config = Config.from_db(workspace_id) if workspace_id else Config()
        run_digest(config, workspace_id)
        if workspace_id:
            update_last_run_at(workspace_id)
        return jsonify({"ok": True})
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(exc)}), 500
    finally:
        _running = False
        _lock.release()


@app.route("/cron", methods=["POST"])
def cron():
    if RUN_SECRET and request.headers.get("X-Run-Secret") != RUN_SECRET:
        return jsonify({"error": "Unauthorized"}), 401

    triggered = []
    skipped = []
    now = datetime.now(timezone.utc)

    for ws in get_all_workspaces():
        ws_id = ws["id"]
        interval = ws.get("schedule_interval", "weekly")
        last_run = ws.get("last_run_at")

        if last_run is None:
            skipped.append(ws_id)
            continue

        seconds = INTERVAL_SECONDS.get(interval, INTERVAL_SECONDS["weekly"])
        try:
            last_dt = datetime.fromisoformat(last_run.replace("Z", "+00:00"))
        except Exception:
            skipped.append(ws_id)
            continue

        if (now - last_dt).total_seconds() < seconds:
            skipped.append(ws_id)
            continue

        # Due — run in background so cron response returns quickly
        def _run(wid=ws_id):
            global _running
            if not _lock.acquire(blocking=False):
                return
            _running = True
            try:
                cfg = Config.from_db(wid)
                run_digest(cfg, wid)
                update_last_run_at(wid)
            except Exception:
                import traceback
                traceback.print_exc()
            finally:
                _running = False
                _lock.release()

        threading.Thread(target=_run, daemon=True).start()
        triggered.append(ws_id)

    return jsonify({"triggered": triggered, "skipped": skipped})


def _schedule_cron():
    """Background thread: call /cron every hour."""
    import time
    import urllib.request

    while True:
        time.sleep(3600)
        port = int(os.environ.get("PORT", 8080))
        try:
            req = urllib.request.Request(
                f"http://localhost:{port}/cron",
                method="POST",
                headers={"X-Run-Secret": RUN_SECRET} if RUN_SECRET else {},
            )
            urllib.request.urlopen(req, timeout=30)
        except Exception:
            pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    threading.Thread(target=_schedule_cron, daemon=True).start()
    app.run(host="0.0.0.0", port=port)
