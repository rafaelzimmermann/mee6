# Task 001 — Scaffold v3 Monorepo

## Goal

Create the `v3` branch, remove all v2 application code, and lay down the
monorepo skeleton with three components: the Rails app (with embedded React
frontend), the WhatsApp microservice, and the Python agent service. Each
component must be immediately runnable in isolation and navigable at a glance.

---

## Branch

```
git checkout main
git checkout -b v3
```

---

## What to remove

Delete all v2 application code. Keep only:
- `prompts/` (migration documentation)
- `LICENSE`, `README.md` (will be rewritten)
- `.git/`

Everything else goes:
- `mee6/` (Python FastAPI app)
- `tests/` (v2 tests)
- `assets/` (v2 static assets)
- `db/` (v2 SQL migrations — schema will be re-created via Rails migrations)
- `scripts/`
- `coverage/`
- `data/`
- `docker-compose.yml` (will be replaced)
- `Dockerfile` (will be replaced)
- `nginx.conf` (will be replaced)
- `pyproject.toml`, `uv.lock` (v2 Python deps)
- `package.json`, `package-lock.json`, `node_modules/`, `vitest.config.js` (v2 JS tooling)
- `debug_rebuild.js`, `minimal_test.js`, `progress.log`
- `whatsapp.yaml.example`

---

## Target directory structure

```
mee6/                              ← repo root
│
├── rails/                         ← Rails API app + React SPA
│   ├── app/
│   │   ├── controllers/
│   │   │   ├── api/v1/
│   │   │   └── webhooks/
│   │   ├── jobs/
│   │   ├── models/
│   │   ├── serializers/
│   │   └── services/
│   │       ├── pipelines/
│   │       ├── triggers/
│   │       ├── memories/
│   │       └── integrations/
│   ├── config/
│   ├── db/
│   │   └── migrate/
│   ├── frontend/                  ← React SPA (Vite + TypeScript)
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   │   ├── ui/
│   │   │   │   ├── pipeline/
│   │   │   │   ├── triggers/
│   │   │   │   ├── integrations/
│   │   │   │   └── layout/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── router.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── spec/
│   ├── Gemfile
│   └── Dockerfile
│
├── services/
│   │
│   ├── whatsapp/                  ← WhatsApp microservice (Python + neonize)
│   │   ├── app/
│   │   │   ├── main.py            ← FastAPI entry point
│   │   │   ├── session.py         ← neonize session management
│   │   │   ├── router.py          ← /status /connect /monitor /send /groups
│   │   │   └── config.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   └── agents/                    ← Python agent service (LLM, Browser, Calendar)
│       ├── app/
│       │   ├── main.py            ← FastAPI entry point
│       │   ├── router.py          ← POST /run, GET /schema
│       │   ├── agents/
│       │   │   ├── llm_agent.py
│       │   │   ├── browser_agent.py
│       │   │   └── calendar_agent.py
│       │   └── config.py
│       ├── tests/
│       ├── pyproject.toml
│       └── Dockerfile
│
├── docker-compose.yml             ← orchestrates all services + postgres + redis
├── docker-compose.dev.yml         ← dev overrides (volume mounts, hot reload)
├── README.md
└── .env.example
```

---

## Rails scaffold

Use API mode. Rails serves the compiled React SPA from `public/` in production;
in development the Vite dev server proxies through Rails.

```bash
cd mee6/
rails new rails \
  --api \
  --database=postgresql \
  --skip-test \
  --skip-action-mailer \
  --skip-action-mailbox \
  --skip-action-cable \
  --skip-active-storage
```

### Gems to add (Gemfile)

```ruby
# Background jobs
gem "sidekiq"
gem "sidekiq-cron"

# HTTP client (for agent service + WhatsApp service)
gem "faraday"

# Serialization
gem "blueprinter"   # or "jsonapi-serializer" — pick one and stick to it

# CORS (React SPA on same origin in prod; separate port in dev)
gem "rack-cors"

group :development, :test do
  gem "rspec-rails"
  gem "factory_bot_rails"
  gem "faker"
end

group :test do
  gem "webmock"        # stub HTTP calls to agent service + whatsapp service
  gem "shoulda-matchers"
end
```

### React frontend (inside rails/frontend/)

```bash
cd rails/
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install react-router-dom @tanstack/react-query react-hook-form
```

Vite config proxies `/api` to Rails in development. In production, `vite build`
outputs to `rails/public/` and Rails serves it statically.

---

## WhatsApp service scaffold

Thin FastAPI app. No database access — all state is in memory (neonize session)
plus a flat config file for persistence across restarts.

```bash
cd services/whatsapp/
# pyproject.toml with: fastapi, uvicorn, neonize, pydantic, httpx
```

### Endpoints (stubs only at this stage)

```
GET  /status          → { status, qr_svg }
POST /connect         → 202
POST /disconnect      → 200
GET  /groups          → []
POST /monitor         → registers callback_url, phones[], group_jids[]
POST /send            → sends DM or group message via neonize
```

All endpoints return `{ "ok": true }` or `{ "error": "not implemented" }` at
scaffold stage — real implementation comes in a later task.

---

## Agent service scaffold

```bash
cd services/agents/
# pyproject.toml with: fastapi, uvicorn, anthropic, pydantic
```

### Endpoints (stubs only)

```
GET  /schema          → { "llm_agent": { label, fields }, ... }
POST /run             → { "output": "stub" }
```

---

## docker-compose.yml

Defines five services:

```yaml
services:
  postgres:   # postgres:16
  redis:      # redis:7
  rails:      # builds rails/Dockerfile; depends on postgres, redis
  whatsapp:   # builds services/whatsapp/Dockerfile; depends on rails (for callback)
  agents:     # builds services/agents/Dockerfile
```

Environment variables wired through `.env` (see `.env.example`):

```
# ── Rails ────────────────────────────────────────────────────────────────────
DATABASE_URL=postgres://postgres:postgres@postgres:5432/mee6_production
REDIS_URL=redis://redis:6379/0
SECRET_KEY_BASE=replace_with_output_of_rails_secret
RAILS_ENV=production
RAILS_BASE_URL=http://localhost:3000

# ── Inter-service secrets (each pair must match on both ends) ─────────────────
# Rails → agent service
AGENT_SERVICE_SECRET=change_me_in_production
# Rails → WhatsApp service
WHATSAPP_SERVICE_SECRET=change_me_in_production
# WhatsApp service → Rails webhook
WEBHOOK_SECRET=change_me_in_production

# ── Sidekiq web UI (production only) ─────────────────────────────────────────
SIDEKIQ_WEB_USER=admin
SIDEKIQ_WEB_PASSWORD=change_me_in_production

# ── Service URLs (internal Docker network) ────────────────────────────────────
AGENT_SERVICE_URL=http://agents:8001
WHATSAPP_SERVICE_URL=http://whatsapp:8002

# ── WhatsApp service ──────────────────────────────────────────────────────────
STORAGE_PATH=/data/whatsapp

# ── Agent service ─────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-replace-me
ANTHROPIC_MODEL=claude-opus-4-5

# ── Google Calendar (optional — only needed if Calendar agent is used) ─────────
# Host path to the OAuth2 credentials JSON downloaded from Google Cloud Console.
# Mounted read-only into the agents container at /run/secrets/google_credentials.json
GOOGLE_CREDENTIALS_PATH=/path/to/google_credentials.json
```

> **Sensitive variables** (`SECRET_KEY_BASE`, `*_SECRET`, `*_PASSWORD`,
> `ANTHROPIC_API_KEY`, `DATABASE_URL`, `REDIS_URL`) must never be committed.
> Copy `.env.example` to `.env` and fill in real values. The `.env` file is
> git-ignored.

---

## README.md (root)

Rewrite with:
- Brief description of the project
- Monorepo layout (one-liner per directory)
- Quick start: `docker compose up`
- Per-service development instructions
- Link to `prompts/v3.md` for architecture decisions

---

## Test tooling setup

Each component must have its test runner configured and runnable from a clean
checkout before any tests are written. This is a prerequisite for every
subsequent task.

### Rails — RSpec

```bash
cd rails/
bundle exec rails generate rspec:install
```

Verify: `bundle exec rspec` exits 0 with "0 examples, 0 failures".

Add to `rails/spec/spec_helper.rb`:
```ruby
RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
end
```

Add to `rails/spec/rails_helper.rb`:
```ruby
Shoulda::Matchers.configure do |config|
  config.integrate { |with| with.test_framework(:rspec); with.library(:rails) }
end
```

### Python services — pytest

Both `services/agents/` and `services/whatsapp/` use pytest.

```toml
# pyproject.toml (both services)
[tool.pytest.ini_options]
testpaths = ["tests"]
```

Verify per service: `pytest --collect-only` exits 0 with "no tests ran".

### React — Vitest

```bash
cd rails/frontend/
npm install --save-dev vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Add to `vite.config.ts`:
```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
}
```

Create `rails/frontend/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

Verify: `npm test -- --run` exits 0 with "no test files found".

---

## Acceptance criteria

- [ ] `git checkout v3` from main works cleanly; no v2 files present
- [ ] `docker compose up` starts all five services without errors
- [ ] `GET http://localhost:3000/up` returns 200 (Rails health check)
- [ ] `GET http://localhost:8001/schema` returns a JSON stub (agent service)
- [ ] `GET http://localhost:8002/status` returns a JSON stub (WhatsApp service)
- [ ] `http://localhost:3000` serves the React SPA index page
- [ ] Each service directory is independently navigable: its own `README`,
      `Dockerfile`, and dependency manifest
- [ ] `cd rails && bundle exec rspec` exits 0 (test tooling configured)
- [ ] `cd services/agents && pytest --collect-only` exits 0
- [ ] `cd services/whatsapp && pytest --collect-only` exits 0
- [ ] `cd rails/frontend && npm test -- --run` exits 0
