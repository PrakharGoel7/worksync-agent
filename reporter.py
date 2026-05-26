from datetime import datetime

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

_MAX_TEXT = 2900  # Slack block text limit is 3000; leave headroom


def _truncate(text: str) -> str:
    return text if len(text) <= _MAX_TEXT else text[:_MAX_TEXT] + "…"


def build_blocks(digest: dict, lookback_days: int) -> list[dict]:
    today = datetime.now().strftime("%B %d, %Y")
    blocks: list[dict] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"Team Digest — {today}", "emoji": True},
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Past {lookback_days} day{'s' if lookback_days != 1 else ''} · Slack Digest Agent",
                }
            ],
        },
        {"type": "divider"},
    ]

    if digest.get("period_summary"):
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": _truncate(f"*Overview*\n{digest['period_summary']}")},
        })
        blocks.append({"type": "divider"})

    # ── Action items ────────────────────────────────────────────────────────
    items = digest.get("action_items", [])
    if items:
        lines = []
        for it in items:
            deadline = f" _(due {it['deadline']})_" if it.get("deadline") not in ("", "unspecified", None) else ""
            lines.append(f"• *{it['owner']}*: {it['task']}{deadline}  [#{it['channel']}]")
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": _truncate(":white_check_mark: *Action Items*\n" + "\n".join(lines))},
        })
        blocks.append({"type": "divider"})

    # ── Blockers ─────────────────────────────────────────────────────────────
    blockers = digest.get("blockers", [])
    if blockers:
        lines = [
            f"• *{b['affected']}*: {b['description']}  [#{b['channel']}]"
            for b in blockers
        ]
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": _truncate(":warning: *Blockers & Bottlenecks*\n" + "\n".join(lines))},
        })
        blocks.append({"type": "divider"})

    # ── Contributions ─────────────────────────────────────────────────────────
    contributions_raw = digest.get("contributions", [])
    if contributions_raw:
        grouped: dict[str, list[str]] = {}
        for c in contributions_raw:
            grouped.setdefault(c["person"], []).append(c["item"])
        lines = []
        for person, work_items in grouped.items():
            lines.append(f"*{person}*")
            lines += [f"  ‣ {w}" for w in work_items]
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": _truncate(":trophy: *Employee Contributions*\n" + "\n".join(lines))},
        })
        blocks.append({"type": "divider"})

    # ── Decisions ─────────────────────────────────────────────────────────────
    decisions = digest.get("decisions", [])
    if decisions:
        lines = [f"• {d}" for d in decisions]
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": _truncate(":memo: *Key Decisions*\n" + "\n".join(lines))},
        })

    # Slack hard-limits at 50 blocks
    return blocks[:50]


def send_digest(client: WebClient, manager_id: str, blocks: list[dict]) -> None:
    try:
        dm = client.conversations_open(users=manager_id)
        channel_id = dm["channel"]["id"]
        client.chat_postMessage(
            channel=channel_id,
            blocks=blocks,
            text="Your weekly team digest is ready.",  # notification fallback
        )
    except SlackApiError as e:
        raise RuntimeError(f"Failed to send digest: {e.response['error']}") from e
