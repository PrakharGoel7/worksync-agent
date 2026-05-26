"""
Minimal HTTP server so Railway can expose the Python agent as a web service.
The Vercel dashboard calls POST /run?workspace=<id> to trigger a digest.
"""

import os
import threading
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()

from config import Config
from main import run_digest

app = Flask(__name__)

RUN_SECRET = os.environ.get("RUN_SECRET", "")

_lock = threading.Lock()
_running = False


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
        return jsonify({"ok": True})
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(exc)}), 500
    finally:
        _running = False
        _lock.release()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
