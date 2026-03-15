from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    anthropic_api_key: str
    anthropic_model: str = "claude-opus-4-5"
    agent_service_secret: str

    model_config = SettingsConfigDict(env_file=".env")


config = Config()
