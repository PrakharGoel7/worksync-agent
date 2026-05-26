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


@app.route("/health")
def health():
    return jsonify({"ok": True})


@app.route("/run", methods=["POST"])
def run():
    if RUN_SECRET and request.headers.get("X-Run-Secret") != RUN_SECRET:
        return jsonify({"error": "Unauthorized"}), 401

    workspace_id = request.args.get("workspace") or request.json.get("workspace") if request.is_json else request.args.get("workspace")

    if not _lock.acquire(blocking=False):
        return jsonify({"error": "A digest is already running"}), 409

    def do_run():
        try:
            config = Config.from_db(workspace_id) if workspace_id else Config()
            run_digest(config, workspace_id)
        except Exception as exc:
            import traceback
            print(f"Digest error: {exc}", flush=True)
            traceback.print_exc()
        finally:
            _lock.release()

    threading.Thread(target=do_run, daemon=True).start()
    return jsonify({"ok": True, "message": "Digest started"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
