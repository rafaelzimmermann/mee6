# mee6

An AI agent pipeline builder and scheduler with a Rails + React monorepo architecture.

## Quick Start

```bash
# 1. Copy environment variables
cp .env.example .env
# Edit .env and fill in required values (SECRET_KEY_BASE, API keys, etc.)

# 2. Start all services
docker compose up -d
```

Services will be available at:
- Rails API + React SPA: http://localhost:3000
- Agent service: http://localhost:8001
- WhatsApp service: http://localhost:8002
- Telegram service: http://localhost:8003

## Monorepo Layout

```
rails/                          ← Rails API app + React SPA
  ├── app/                      ← Models, controllers, services
  ├── frontend/                 ← React Vite + TypeScript
  ├── spec/                     ← RSpec tests
  ├── Gemfile                   ← Ruby dependencies
  └── Dockerfile                ← Rails app image
services/
  ├── whatsapp/                  ← WhatsApp microservice (Python + neonize)
  │   ├── app/                  ← FastAPI app (main.py, router.py, session.py, config.py)
  │   ├── tests/                ← pytest tests
  │   ├── pyproject.toml        ← Python dependencies
  │   └── Dockerfile            ← WhatsApp service image
  ├── agents/                    ← Python agent service (LLM, Browser, Calendar)
  │   ├── app/                  ← FastAPI app (main.py, router.py, agents/, config.py)
  │   ├── tests/                ← pytest tests
  │   ├── pyproject.toml        ← Python dependencies
  │   └── Dockerfile            ← Agent service image
  └── telegram/                 ← Telegram microservice (Python + python-telegram-bot)
      ├── app/                  ← FastAPI app (main.py, router.py, session.py, store.py)
      ├── pyproject.toml        ← Python dependencies
      └── Dockerfile            ← Telegram service image
docker-compose.yml               ← Production orchestration
docker-compose.dev.yml           ← Development overrides
.env.example                    ← Environment variable template
prompts/v3/                     ← v3 architecture and task documentation
```

## Service Development

### Rails (API + React)

```bash
cd rails

# Install dependencies
bundle install
cd frontend && npm install

# Run tests
bundle exec rspec
cd frontend && npm test -- --run

# Run dev server (Rails)
bundle exec rails server

# Run dev server (React with hot reload)
cd frontend && npm run dev
```

### WhatsApp Service

```bash
cd services/whatsapp

# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest --collect-only

# Run dev server
uvicorn app.main:app --reload
```

### Agent Service

```bash
cd services/agents

# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest --collect-only

# Run dev server
uvicorn app.main:app --reload
```

### Telegram Service

```bash
cd services/telegram

# Install dependencies
pip install -e ".[dev]"

# Run dev server
uvicorn app.main:app --reload --port 8003
```

## Development with Docker Compose

For local development with hot reload:

```bash
# Override with dev configuration (volume mounts, exposed ports)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Architecture

```
Browser / WhatsApp / Telegram
        │
        ▼
  Rails API (port 3000)
  ├── Pipelines — step-based workflow builder
  ├── Triggers  — cron, WhatsApp DM/group, Telegram DM/group
  └── Integrations
        ├── WhatsApp service (port 8002) — neonize multi-device
        ├── Telegram service (port 8003) — python-telegram-bot
        ├── Agent service   (port 8001) — LLM, Browser, Calendar
        ├── Memories        — per-label key/value store
        └── Calendars       — Google Calendar read access
```

### Trigger types

| Type | Description |
|------|-------------|
| `cron` | Scheduled execution via cron expression |
| `whatsapp` | Incoming WhatsApp DM from a specific phone number |
| `wa_group` | Incoming WhatsApp group message |
| `telegram_dm` | Incoming Telegram DM from a known user |
| `telegram_chat` | Incoming Telegram group/channel message |

### Pipeline step types

| Agent | Description |
|-------|-------------|
| `llm` | Call an LLM with a prompt (supports memory placeholders) |
| `browser` | Headless browser for web scraping / search |
| `calendar` | Read upcoming Google Calendar events |
| `memory_agent` | Store a value in a named memory |
| `whatsapp_send` | Send a WhatsApp message |
| `telegram_send` | Send a Telegram message |
