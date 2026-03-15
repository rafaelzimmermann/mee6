from pydantic import BaseSettings


class Settings(BaseSettings):
    storage_path: str = "/data/whatsapp"
    webhook_secret: str = "change_me_in_production"

    class Config:
        env_file = ".env"


settings = Settings()
