import os

RAILS_BASE_URL: str = os.environ.get("RAILS_BASE_URL", "http://localhost:3000")
WEBHOOK_SECRET: str = os.environ.get("WEBHOOK_SECRET", "changeme")
TELEGRAM_SERVICE_SECRET: str = os.environ.get("TELEGRAM_SERVICE_SECRET", "changeme")
