from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM backends
    anthropic_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "llama3"

    # School app
    school_app_url: str = ""
    school_app_username: str = ""
    school_app_password: str = ""

    # WhatsApp
    notify_phone_number: str = ""
    whatsapp_storage_path: str = "./data/whatsapp"

    # Google Calendar
    google_calendar_id: str = ""
    google_credentials_file: str = "/app/data/credentials.json"


settings = Settings()
