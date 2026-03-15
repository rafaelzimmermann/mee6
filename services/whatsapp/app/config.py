import os

RAILS_BASE_URL: str = os.environ.get("RAILS_BASE_URL", "http://localhost:3000")
WEBHOOK_SECRET: str = os.environ.get("WEBHOOK_SECRET", "changeme")
STORAGE_PATH: str = os.environ.get("STORAGE_PATH", "/data/whatsapp")
