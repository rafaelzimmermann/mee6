# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `whatsapp` trigger type: pipelines can now be triggered when a WhatsApp message is
  received from a configured phone number (E.164). The trigger type selector in the
  triggers UI switches between "Cron schedule" and "On WhatsApp message received",
  showing the appropriate field (cron expression or phone number). WA triggers are
  stored in the DB with `trigger_type="whatsapp"` and `config={"phone": "..."}` and
  are matched against incoming messages in real-time via `SchedulerEngine.check_wa_triggers`.
- `TriggerType(str, Enum)` with `CRON` and `WHATSAPP` members replaces bare string
  literals throughout `engine.py` and `routes/triggers.py`; extending with new trigger
  types requires a single line addition to the enum.
- `whatsapp_read` pipeline step type: reads the last N messages (1–10, configurable)
  from a given phone number out of the local DB and passes them as text to the next step.
- `WhatsAppMessageRow` DB model (`whatsapp_messages` table) and `WhatsAppMessageRepository`
  persist every incoming text message so `whatsapp_read` can query recent history.
- `llm_agent` pipeline step type: calls Anthropic or Ollama with a configurable
  prompt and returns the text response. When `{previous_output}` appears in the
  prompt template it is formatted inline; otherwise the previous step's output is
  automatically prepended as context so the step works naturally at any position in
  a pipeline without requiring the user to reference it explicitly.
- `combobox` field type for the pipeline builder: renders as `<input list>` +
  `<datalist>` so the user sees a dropdown of suggestions but can also type any
  custom value. Used for the `llm_agent` provider and model fields.
- PostgreSQL persistence via SQLAlchemy 2.x async + asyncpg: `db/engine.py`,
  `db/models.py` (`PipelineRow`, `TriggerRow`, `RunRecordRow`), `db/repository.py`
  (three repository classes). Tables created with `create_all` at startup.
- History page (`/`) replaces the old Dashboard: HTMX auto-poll every 10s, status
  badges, and a `/history/rows` partial endpoint.
- Integrations page (`/integrations`) with WhatsApp connection card: QR code rendered
  as inline SVG via `segno`, HTMX status polling every 2 s during connection.
- `WhatsAppSession` class (`mee6/integrations/whatsapp_session.py`) managing the full
  connection lifecycle (DISCONNECTED → CONNECTING → PENDING_QR → CONNECTED → ERROR):
  immediate detection via neonize `ConnectedEv`/`DisconnectedEv` callbacks, polling
  fallback via `is_connected()`, and a QR watchdog that restarts the connection if no
  fresh QR has arrived within 65 s.
- WhatsApp test button on the integrations page: sends a test message to the user's own
  phone number and shows the result inline via HTMX.
- `browser_agent` pipeline step type: wraps `browser-use` 0.11.13 to run autonomous
  Chromium-based browsing tasks as part of a pipeline.
- Startup auto-reconnect for WhatsApp: `wa_session.connect()` is called in the FastAPI
  lifespan so an existing session resumes automatically after a container restart.
- `BROWSER_USE_CONFIG_DIR=/app/data/browseruse` env var in the Docker image so
  `browser-use` can write its config/profiles to a writable path.
- `ANONYMIZED_TELEMETRY=false` in `docker-compose.yml` to disable `browser-use`'s
  PostHog telemetry (which blocks on DNS in restricted Docker networks).

### Fixed
- `_store_incoming` timestamp conversion: `msg.timestamp` from `agntrick_whatsapp` is a
  Unix millisecond integer (e.g. `1773330464000`), not a `datetime`. Added an
  `isinstance(int, float)` branch that divides by 1000; a follow-up fix strips `tzinfo`
  before the DB insert because the `whatsapp_messages.timestamp` column is
  `TIMESTAMP WITHOUT TIME ZONE`.
- `_store_incoming` error visibility: replaced bare `except: pass` with
  `logger.exception(...)` so DB and trigger errors are surfaced in logs instead of
  being silently swallowed.
- `_dispatch_pipeline` now logs exceptions via `logger.exception` in addition to storing
  the error string as the run summary.
- `TriggerRow` startup migration: `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements
  in the app lifespan add `trigger_type` and `config` to existing `triggers` tables,
  and make `cron_expr` nullable, without requiring Alembic.

### Changed
- `PipelineStore` is now fully async and DB-backed; all `pipeline_store.*` call-sites
  updated to `await`.
- Scheduler engine persistence moved from JSON files to PostgreSQL; `_load_from_db()`
  replaces `_load_triggers()` on startup.
- `docker-compose.yml` now includes a `postgres:16-alpine` service with health-check and
  named volume; `mee6` service gains `DATABASE_URL` and `depends_on: postgres (healthy)`.
- Volume mount for the agntrick config directory changed from `:ro` to read-write so
  neonize can persist the WhatsApp session file across container restarts.
- Base template: added HTMX script tag, renamed "Dashboard" nav link to "History",
  added "Integrations" nav link.
- `style.css`: added badge styles (`.badge-success`, `.badge-error`, `.badge-connected`,
  `.badge-pending_qr`, etc.) and QR-code card styles (`.qr-wrap`, `.qr-hint`).
- `browser_agent` wrapper now uses `browser_use.llm.anthropic.chat.ChatAnthropic`
  instead of `langchain_anthropic.ChatAnthropic` (the langchain version is missing the
  `.provider` attribute expected by `browser-use` internals).

### Fixed
- Dockerfile: `playwright` CLI invocation changed from `/app/.venv/bin/playwright` to
  `python -m playwright` (the console-script wrapper is not installed in the venv).
- Dockerfile: Playwright browsers installed to `PLAYWRIGHT_BROWSERS_PATH=/app/playwright-browsers`
  (root-owned, world-readable) instead of the default `~/.cache/ms-playwright`, so the
  non-root `mee6` user can access the binaries at runtime.
- Dockerfile: `/home/mee6/.config` created with `mee6:mee6` ownership before switching
  to the `mee6` user, preventing Docker from creating it as root when bind-mounting a
  subdirectory (which would block `browser-use` from writing its config).
- `browser_agent`: `browser-use` 0.11.13 uses `chrome-headless-shell` (not the regular
  `chrome` binary) when launched by Playwright; `_find_headless_shell()` detects the
  correct binary path and sets `BrowserProfile(executable_path=...)` explicitly, avoiding
  the SIGTRAP crash that occurs when the full `chrome` binary is launched headlessly in Docker.
- `pyproject.toml`: added explicit `playwright>=1.58.0` dependency (`browser-use` 0.11.13
  dropped it as a direct dependency).
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
