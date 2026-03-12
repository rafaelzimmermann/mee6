# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Initial project scaffold for mee6 personal AI assistant.
- FastAPI web UI with dashboard (recent task runs) and triggers (CRUD for cron schedules).
- APScheduler 4.x (`AsyncScheduler`) engine integrated into FastAPI lifespan; jobs persist
  in memory (SQLAlchemy/SQLite path documented for future use).
- `school-monitor` agent using agntrick `AgentBase` and `@AgentRegistry.register`:
  fetches school app content, extracts calendar events via LLM, creates Google Calendar
  entries, and sends WhatsApp notifications.
- `agntrick-whatsapp` integration via `WhatsAppChannel` + `OutgoingMessage`.
- Google Calendar integration stub using `google-api-python-client` service account auth.
- School app HTTP client stub (httpx-based login + calendar page fetch).
- pydantic-settings `Settings` class for all configuration via environment variables.
- Multi-stage Dockerfile (builder + runtime, non-root `mee6` user, port 8080).
- `docker-compose.yml` with single `mee6` service; Ollama is external (no Docker service).
- `.agntrick.yaml` configured for Anthropic Claude (`claude-haiku-4-5-20251001`, temp 0.2),
  with inline comment showing how to switch to Ollama.
- `.env.example` with all required variables and explanatory comments.
- Pytest test suite (3 tests) covering happy path, invalid JSON, and per-event error handling.
