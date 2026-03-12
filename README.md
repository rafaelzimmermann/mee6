# mee6

A personal AI assistant that automates life tasks using LLMs.

## Overview

mee6 runs scheduled AI agents that connect to external services on your behalf.
It exposes a web UI to configure and trigger jobs, and supports both Anthropic (Claude)
and Ollama (local LLMs) as backends.

**Runtime:** Python 3.12, managed with `uv`, deployed via Docker.
**LLM backends:** Anthropic Claude (cloud) or Ollama (self-hosted, external server).
**Agent framework:** [agntrick](https://github.com/jeancsil/agntrick) + agntrick-whatsapp.

## Quick start

```bash
# 1. Copy and fill in your credentials
cp .env.example .env

# 2. Install dependencies
uv sync

# 3. Run locally (dev mode)
uvicorn mee6.web.app:app --reload --port 8080
```

Open http://localhost:8080 to access the dashboard.

## Docker

```bash
docker compose up -d
```

The container exposes port `8080`. Persistent data (scheduler state, WhatsApp session)
is stored in `./data/`.

## Configuration

All configuration is via environment variables (see `.env.example`).

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `OLLAMA_BASE_URL` | URL of your existing Ollama server (e.g. `http://192.168.1.x:11434`) |
| `OLLAMA_DEFAULT_MODEL` | Default Ollama model (default: `llama3`) |
| `SCHOOL_APP_URL` | Base URL of the school app |
| `SCHOOL_APP_USERNAME` | School app login username |
| `SCHOOL_APP_PASSWORD` | School app login password |
| `NOTIFY_PHONE_NUMBER` | WhatsApp target number in E.164 format (e.g. `+34612345678`) |
| `WHATSAPP_STORAGE_PATH` | Path for neonize session data (default: `./data/whatsapp`) |
| `GOOGLE_CALENDAR_ID` | Google Calendar ID to write events to |
| `GOOGLE_CREDENTIALS_FILE` | Path to Google service account credentials JSON |

To switch LLM provider, edit `.agntrick.yaml`:

```yaml
llm:
  provider: ollama          # or: anthropic
  model: llama3             # or: claude-haiku-4-5-20251001
  base_url: http://192.168.1.x:11434   # only needed for ollama
  temperature: 0.2
```

## Agents

### school-monitor

Reads the kids' school app, extracts upcoming calendar events, creates entries in
Google Calendar, and sends WhatsApp notifications for each event.

**Schedule example (daily at 08:00):** add a trigger via the web UI with cron `0 8 * * *`.

## Development

```bash
# Run tests
uv run --extra dev pytest

# Lint
uv run --extra dev ruff check .
```

## Project structure

```
mee6/
├── mee6/
│   ├── config.py               # pydantic-settings
│   ├── web/                    # FastAPI app + Jinja2 UI
│   ├── scheduler/              # APScheduler engine + task registry
│   ├── agents/school_monitor/  # agntrick agent
│   ├── integrations/           # WhatsApp, Google Calendar, school app
│   └── tasks/                  # Orchestration functions
└── tests/
```
