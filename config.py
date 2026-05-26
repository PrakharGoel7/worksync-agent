import os


class Config:
    def __init__(self):
        self.slack_bot_token: str = os.environ["SLACK_BOT_TOKEN"]
        self.openrouter_api_key: str = os.environ["OPENROUTER_API_KEY"]
        self.manager_slack_id: str = os.environ["MANAGER_SLACK_ID"]
        self.channels: list[str] = [
            c.strip() for c in os.environ.get("SLACK_CHANNELS", "").split(",") if c.strip()
        ]
        self.lookback_days: int = int(os.environ.get("LOOKBACK_DAYS", "7"))
        self.model: str = os.environ.get("CLAUDE_MODEL", "anthropic/claude-sonnet-4-5")

        if not self.channels:
            raise ValueError("SLACK_CHANNELS must list at least one channel name")

    @classmethod
    def from_db(cls, workspace_id: str) -> "Config":
        """Load config from the DB for a given workspace (used in multi-tenant mode)."""
        from storage import load_workspace_config
        data = load_workspace_config(workspace_id)
        if not data:
            raise ValueError(f"Workspace '{workspace_id}' not found in database")

        cfg = object.__new__(cls)
        cfg.slack_bot_token = data["bot_token"]
        cfg.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY", "")
        cfg.manager_slack_id = data["manager_slack_id"]
        cfg.channels = data["channels"]
        cfg.lookback_days = data["lookback_days"]
        cfg.model = data.get("model") or os.environ.get("CLAUDE_MODEL", "anthropic/claude-sonnet-4-5")

        if not cfg.channels:
            raise ValueError(f"Workspace '{workspace_id}' has no channels configured")
        if not cfg.manager_slack_id:
            raise ValueError(f"Workspace '{workspace_id}' has no manager configured")
        if not cfg.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is required")

        return cfg
