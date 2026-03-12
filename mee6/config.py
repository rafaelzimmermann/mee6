from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_CONFIG_DIR = Path.home() / ".config/agntrick"


class Settings(BaseSettings):
    """Config is loaded from three sources (later = higher priority):
    1. ~/.config/agntrick/.env          — global: API keys, Ollama URL
    2. ~/.config/agntrick/.mee6.conf    — project config kept in the shared config dir
    3. .mee6.conf                       — project config in the repo root (gitignored)
    Environment variables override all files.
    """

    model_config = SettingsConfigDict(
        env_file=(
            str(_CONFIG_DIR / ".env"),
            str(_CONFIG_DIR / ".mee6.conf"),
            ".mee6.conf",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Directory where global agntrick config lives (whatsapp.yaml, .agntrick.yaml, .mee6.conf, etc.)
    agntrick_config_dir: str = str(_CONFIG_DIR)

    # LLM backends — typically in ~/.config/agntrick/.env
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "llama3"

    # PostgreSQL connection URL (asyncpg driver)
    database_url: str = "postgresql+asyncpg://mee6:mee6@localhost:5432/mee6"

    # Notification target — project-specific, in .mee6.conf
    notify_phone_number: str = ""

    # Google Calendar — project-specific, in .mee6.conf
    google_calendar_id: str = ""
    google_credentials_file: str = "/app/data/credentials.json"

    @property
    def config_dir(self) -> Path:
        return Path(self.agntrick_config_dir).expanduser()


settings = Settings()
