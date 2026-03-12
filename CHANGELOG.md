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
- WhatsApp config loaded from `~/.config/agntrick/whatsapp.yaml` via `WhatsAppAgentConfig`;
  removed per-project env vars for WhatsApp (`WHATSAPP_STORAGE_PATH`, `NOTIFY_PHONE_NUMBER`).
- `whatsapp.yaml.example` and `.mee6.conf.example` documenting the new config layout.
- `scripts/install-requirements.sh` — checks/installs system dependencies (libmagic, ffmpeg,
  uv, Python 3.12+) and the gcloud CLI with automatic PATH configuration.
- `scripts/setup-google-credentials.sh` — end-to-end GCP setup: creates project, enables
  Calendar API, creates service account, downloads `credentials.json`.
- 34 unit tests across three modules: scheduler engine, web routes, and integration stubs.

### Changed
- Config now loaded from three layered sources (later = higher priority):
  `~/.config/agntrick/.env` → `~/.config/agntrick/.mee6.conf` → `.mee6.conf` (repo root).
  `AGNTRICK_CONFIG_DIR` env var allows overriding the shared config directory.
- `.env.example` updated to only document global keys (API keys, Ollama URL); project-specific
  variables moved to `.mee6.conf.example`.
- `docker-compose.yml` updated to read from the three-layer config and mount the agntrick
  config directory into the container (`~/.config/agntrick:/home/mee6/.config/agntrick:ro`).
- `.gitignore` updated to exclude `.mee6.conf` (local project config).

### Fixed
- APScheduler 4.x startup crash (`RuntimeError: The scheduler has not been initialized yet`):
  `SchedulerEngine.start()` now uses `AsyncExitStack` to enter the scheduler's async context
  and keep it alive for the full app lifetime.
- Docker build failure (`hatchling: Unable to determine which files to ship`): `uv sync` in
  the builder stage now uses `--no-install-project` so source code is not required at that layer.
- Dockerfile runtime stage now installs `libmagic1` (required by agntrick-whatsapp/neonize).
- Jinja2 `TemplateResponse` deprecation: `request` is now passed as the first positional
  argument in dashboard and triggers routes.
- Added `.dockerignore` to exclude `.venv/`, `data/`, test files, and editor caches from
  the Docker build context (reduces context size significantly).
