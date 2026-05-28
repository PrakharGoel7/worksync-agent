import time
from datetime import datetime, timedelta

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError


class SlackFetcher:
    def __init__(self, token: str):
        self.client = WebClient(token=token)
        self._user_cache: dict[str, str] = {}

    def resolve_user(self, user_id: str) -> str:
        if user_id in self._user_cache:
            return self._user_cache[user_id]
        try:
            resp = self.client.users_info(user=user_id)
            name = resp["user"].get("real_name") or resp["user"]["name"]
        except SlackApiError:
            name = user_id
        self._user_cache[user_id] = name
        return name

    def get_channel_ids(self, channel_names: list[str]) -> dict[str, str]:
        """Return {name: id} for the requested channel names."""
        wanted = set(channel_names)
        found: dict[str, str] = {}
        cursor = None
        while True:
            resp = self.client.conversations_list(
                types="public_channel,private_channel",
                limit=200,
                cursor=cursor,
            )
            for ch in resp.get("channels", []):
                if ch["name"] in wanted:
                    found[ch["name"]] = ch["id"]
            cursor = resp.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break
            time.sleep(0.5)  # stay inside Tier-2 rate limit
        return found

    def fetch_channel(self, channel_id: str, lookback_days: int) -> list[dict]:
        oldest = str((datetime.now() - timedelta(days=lookback_days)).timestamp())
        messages: list[dict] = []
        cursor = None
        while True:
            try:
                resp = self.client.conversations_history(
                    channel=channel_id,
                    oldest=oldest,
                    limit=200,
                    cursor=cursor,
                )
            except SlackApiError as e:
                if e.response["error"] == "ratelimited":
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    time.sleep(retry_after)
                    continue
                if e.response["error"] == "not_in_channel":
                    # Auto-join public channels; skip private ones the bot isn't in
                    try:
                        self.client.conversations_join(channel=channel_id)
                        continue  # retry after joining
                    except SlackApiError:
                        print(f"  Skipping channel {channel_id}: bot not invited")
                        return []
                raise

            for msg in resp.get("messages", []):
                if msg.get("type") != "message" or msg.get("subtype"):
                    continue
                entry = {
                    "user": self.resolve_user(msg.get("user", "unknown")),
                    "text": msg.get("text", ""),
                    "ts": msg["ts"],
                    "replies": [],
                }
                if msg.get("reply_count", 0) > 0:
                    entry["replies"] = self._fetch_thread(channel_id, msg["ts"])
                messages.append(entry)

            cursor = resp.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break
            time.sleep(0.3)

        return messages

    def _fetch_thread(self, channel_id: str, thread_ts: str) -> list[dict]:
        try:
            resp = self.client.conversations_replies(
                channel=channel_id, ts=thread_ts, limit=100
            )
            return [
                {
                    "user": self.resolve_user(m.get("user", "unknown")),
                    "text": m.get("text", ""),
                    "ts": m.get("ts", thread_ts),
                }
                for m in resp.get("messages", [])[1:]  # skip parent
            ]
        except SlackApiError:
            return []
