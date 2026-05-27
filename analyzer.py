import json
from openai import OpenAI

_SYSTEM_PROMPT = """You are an executive assistant analyzing Slack messages on behalf of a manager.
Extract only signal — skip social chatter, emoji reactions, and off-topic banter.

You must call the `create_digest` function with:
- action_items: concrete tasks with an assigned owner and deadline (use "unspecified" if no date mentioned). If multiple messages refer to the same task or follow up on the same action, create only ONE entry — use the earliest mention's date if relevant. Do not create separate entries for reminders or repeated mentions of the same task.
- contributions: list of {person, item, date} — date is YYYY-MM-DD of when the message was sent
- blockers: issues preventing progress, who is affected, and which channel it appeared in. If multiple messages refer to the same underlying issue, create only ONE blocker entry for it — use the date of the first mention. Do not create separate entries for follow-ups or repeated mentions of the same problem.
- decisions: key decisions made or still pending
- period_summary: 2–3 sentence plain-English overview of what the team did this period

Attribute everything to the person who said or committed to it. If no one is clearly assigned, mark owner as "unassigned".

IMPORTANT — owner and affected fields must be a real individual's first name or full name as it appears in the messages. Never use group labels like "IRC team", "the team", "scheduling team", or any collective noun. If a task or blocker affects multiple specific people, list their individual names separated by commas (e.g. "Prakhar, Miroslav"). If you cannot identify a specific individual, use "unassigned"."""

_MAX_CONTEXT_CHARS = 180_000


def _render_messages(channel_name: str, messages: list[dict]) -> str:
    from datetime import datetime
    lines = [f"=== #{channel_name} ==="]
    for msg in messages:
        try:
            date = datetime.fromtimestamp(float(msg["ts"])).strftime("%Y-%m-%d")
        except (KeyError, ValueError):
            date = "unknown"
        lines.append(f"\n[{date}] [{msg['user']}]: {msg['text']}")
        for reply in msg.get("replies", []):
            lines.append(f"  ↳ [{reply['user']}]: {reply['text']}")
    return "\n".join(lines)


def _build_context(channel_data: dict[str, list[dict]]) -> str:
    parts = [
        _render_messages(name, msgs)
        for name, msgs in channel_data.items()
        if msgs
    ]
    full = "\n\n".join(parts)
    if len(full) > _MAX_CONTEXT_CHARS:
        full = full[:_MAX_CONTEXT_CHARS] + "\n\n[... earlier messages truncated ...]"
    return full


_TOOL = {
    "type": "function",
    "function": {
        "name": "create_digest",
        "description": "Produce a structured manager digest from analyzed Slack messages.",
        "parameters": {
            "type": "object",
            "required": ["action_items", "contributions", "blockers", "decisions", "period_summary"],
            "properties": {
                "action_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["owner", "task", "deadline", "channel"],
                        "properties": {
                            "owner":    {"type": "string"},
                            "task":     {"type": "string"},
                            "deadline": {"type": "string"},
                            "channel":  {"type": "string"},
                        },
                    },
                },
                "contributions": {
                    "type": "array",
                    "description": "list of individual contributions with the date the message was sent",
                    "items": {
                        "type": "object",
                        "required": ["person", "item", "date"],
                        "properties": {
                            "person": {"type": "string"},
                            "item":   {"type": "string"},
                            "date":   {"type": "string", "description": "YYYY-MM-DD of the message"},
                        },
                    },
                },
                "blockers": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["description", "affected", "channel", "date"],
                        "properties": {
                            "description": {"type": "string"},
                            "affected":    {"type": "string"},
                            "channel":     {"type": "string"},
                            "date":        {"type": "string", "description": "YYYY-MM-DD of the message where the blocker was reported"},
                        },
                    },
                },
                "decisions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["decision", "channel", "date"],
                        "properties": {
                            "decision": {"type": "string"},
                            "channel":  {"type": "string"},
                            "date":     {"type": "string", "description": "YYYY-MM-DD of the message where the decision was made"},
                        },
                    },
                },
                "period_summary": {"type": "string"},
            },
        },
    },
}

_EMPTY_DIGEST = {
    "action_items": [],
    "contributions": [],
    "blockers": [],
    "decisions": [],
    "period_summary": "No messages found in the monitored channels for this period.",
}


def analyze(api_key: str, channel_data: dict[str, list[dict]], model: str) -> dict:
    context = _build_context(channel_data)
    if not context.strip():
        return _EMPTY_DIGEST

    client = OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        timeout=120.0,
    )

    response = client.chat.completions.create(
        model=model,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"Analyze these Slack messages and create a manager digest:\n\n{context}"},
        ],
        tools=[_TOOL],
        tool_choice={"type": "function", "function": {"name": "create_digest"}},
    )

    tool_call = response.choices[0].message.tool_calls
    if tool_call:
        return json.loads(tool_call[0].function.arguments)

    return _EMPTY_DIGEST
