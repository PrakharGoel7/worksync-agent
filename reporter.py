from datetime import datetime
from collections import Counter

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

_MAX_TEXT = 2900


def _truncate(text: str) -> str:
    return text if len(text) <= _MAX_TEXT else text[:_MAX_TEXT] + "…"


def _top_contributors(contributions: list[dict], n: int = 5) -> list[tuple[str, int]]:
    counts = Counter(c["person"] for c in contributions if c.get("person"))
    return counts.most_common(n)


def build_blocks(
    digest: dict,
    lookback_days: int,
    dashboard_url: str | None = None,
    pr_count: int | None = None,
) -> list[dict]:
    today = datetime.now().strftime("%B %d, %Y")
    action_items = digest.get("action_items", [])
    blockers     = digest.get("blockers", [])
    decisions    = digest.get("decisions", [])
    contributions = digest.get("contributions", [])

    blocks: list[dict] = []

    # ── Header ────────────────────────────────────────────────────────────────
    blocks.append({
        "type": "header",
        "text": {"type": "plain_text", "text": f"Rundown — {today}", "emoji": True},
    })
    blocks.append({
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": f"Past {lookback_days} day{'s' if lookback_days != 1 else ''}"}],
    })

    # ── Counts summary strip ──────────────────────────────────────────────────
    parts = [
        f"*{len(action_items)}* action item{'s' if len(action_items) != 1 else ''}",
        f"*{len(blockers)}* blocker{'s' if len(blockers) != 1 else ''}",
        f"*{len(decisions)}* decision{'s' if len(decisions) != 1 else ''}",
    ]
    if pr_count is not None:
        parts.append(f"*{pr_count}* PR{'s' if pr_count != 1 else ''}")

    top = _top_contributors(contributions)
    if top:
        contributor_str = "  ·  ".join(f"{name} ({n})" for name, n in top)
        parts.append(f"\n:trophy: {contributor_str}")

    blocks.append({"type": "divider"})
    blocks.append({
        "type": "section",
        "text": {"type": "mrkdwn", "text": "  ·  ".join(parts)},
    })
    blocks.append({"type": "divider"})

    # ── Action items: show 1, summarise rest ──────────────────────────────────
    if action_items:
        first = action_items[0]
        deadline = f" _(due {first['deadline']})_" if first.get("deadline") not in ("", "unspecified", None) else ""
        line = f":white_check_mark: *Action Items*\n• *{first['owner']}*: {first['task']}{deadline}  [#{first['channel']}]"
        if len(action_items) > 1:
            line += f"\n_+ {len(action_items) - 1} more action item{'s' if len(action_items) - 1 != 1 else ''}_"
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": _truncate(line)}})
        blocks.append({"type": "divider"})

    # ── Blockers: show 1, summarise rest ─────────────────────────────────────
    if blockers:
        first = blockers[0]
        line = f":warning: *Blockers*\n• *{first['affected']}*: {first['description']}  [#{first['channel']}]"
        if len(blockers) > 1:
            line += f"\n_+ {len(blockers) - 1} more blocker{'s' if len(blockers) - 1 != 1 else ''}_"
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": _truncate(line)}})
        blocks.append({"type": "divider"})

    # ── Decisions: show 1, summarise rest ────────────────────────────────────
    if decisions:
        first = decisions[0]
        line = f":memo: *Decisions*\n• {first['decision']}"
        if len(decisions) > 1:
            line += f"\n_+ {len(decisions) - 1} more decision{'s' if len(decisions) - 1 != 1 else ''}_"
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": _truncate(line)}})
        blocks.append({"type": "divider"})

    # ── CTA ───────────────────────────────────────────────────────────────────
    if dashboard_url:
        blocks.append({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {"type": "plain_text", "text": "View full dashboard →", "emoji": False},
                "url": dashboard_url,
                "style": "primary",
            }],
        })
    else:
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": "_Open the dashboard for full detail_"}],
        })

    return blocks[:50]


def send_digest(client: WebClient, manager_id: str, blocks: list[dict]) -> None:
    try:
        dm = client.conversations_open(users=manager_id)
        channel_id = dm["channel"]["id"]
        client.chat_postMessage(
            channel=channel_id,
            blocks=blocks,
            text="Your Rundown is ready.",
        )
    except SlackApiError as e:
        raise RuntimeError(f"Failed to send digest: {e.response['error']}") from e
