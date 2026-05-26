#!/usr/bin/env python3
"""
Slack Digest Agent — fetches channel messages, analyzes them with Claude,
and DMs a structured digest to the manager.

Usage:
  python main.py                          # run once (env-based config)
  python main.py --workspace T12345678   # run once for a specific workspace
  python main.py --schedule daily         # run Mon–Fri at 9 AM
  python main.py --schedule weekly        # run every Monday at 9 AM
"""

import argparse
import sys

import schedule
import time
from dotenv import load_dotenv
from slack_sdk import WebClient

from config import Config
from fetcher import SlackFetcher
from analyzer import analyze
from reporter import build_blocks, send_digest
from storage import save_digest


def run_digest(config: Config, workspace_id: str | None = None) -> None:
    fetcher = SlackFetcher(config.slack_bot_token)

    print(f"Resolving channel names for: {config.channels}")
    channel_map = fetcher.get_channel_ids(config.channels)
    print(f"  Resolved: {list(channel_map.keys())}")
    missing = set(config.channels) - set(channel_map)
    if missing:
        print(f"  Warning: channels not found: {', '.join(missing)}")

    if not channel_map:
        print("No accessible channels found. Aborting.", file=sys.stderr)
        return

    print(f"Fetching messages from {len(channel_map)} channel(s) (last {config.lookback_days} days)...")
    channel_data: dict[str, list[dict]] = {}
    for name, ch_id in channel_map.items():
        msgs = fetcher.fetch_channel(ch_id, config.lookback_days)
        channel_data[name] = msgs
        print(f"  #{name}: {len(msgs)} messages")

    total = sum(len(v) for v in channel_data.values())
    if total == 0:
        print("No messages in the lookback window. Nothing to digest.")
        return

    print(f"Analyzing {total} messages with Claude ({config.model})...")
    digest = analyze(config.openrouter_api_key, channel_data, config.model)

    digest_id = save_digest(digest, config.lookback_days, total, workspace_id)
    print(f"Digest saved to database (id={digest_id})")

    print("Sending digest to manager...")
    slack_client = WebClient(token=config.slack_bot_token)
    blocks = build_blocks(digest, config.lookback_days)
    send_digest(slack_client, config.manager_slack_id, blocks)
    print("Done.")


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Slack Digest Agent")
    parser.add_argument(
        "--workspace",
        default=None,
        metavar="WORKSPACE_ID",
        help="Slack team ID to load config from DB (multi-tenant mode)",
    )
    parser.add_argument(
        "--schedule",
        choices=["daily", "weekly"],
        default=None,
        help="Run on a recurring schedule instead of once",
    )
    args = parser.parse_args()

    if args.workspace:
        config = Config.from_db(args.workspace)
        workspace_id = args.workspace
    else:
        config = Config()
        workspace_id = None

    if args.schedule is None:
        run_digest(config, workspace_id)
        return

    def job() -> None:
        print(f"[{time.strftime('%Y-%m-%d %H:%M')}] Starting scheduled digest...")
        try:
            run_digest(config, workspace_id)
        except Exception as exc:
            print(f"Digest failed: {exc}", file=sys.stderr)

    if args.schedule == "daily":
        for day in ("monday", "tuesday", "wednesday", "thursday", "friday"):
            getattr(schedule.every(), day).at("09:00").do(job)
        print("Scheduled: digest at 9:00 AM, Mon–Fri. Press Ctrl+C to stop.")
    else:
        schedule.every().monday.at("09:00").do(job)
        print("Scheduled: digest every Monday at 9:00 AM. Press Ctrl+C to stop.")

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
