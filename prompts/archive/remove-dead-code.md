# Dead Code Cleanup — Pipeline Editor Refactoring

## Context

The pipeline editor was refactored from server-rendered HTML forms to a JSON REST API
(`mee6/web/api/pipelines.py`, `mee6/web/api/agents.py`) plus a client-side JS editor
(`mee6/web/static/js/pipeline-editor.js` and `modules/`).

The old form-based routes in `mee6/web/routes/pipelines.py` were left in place so the
app kept working during the refactor. They are now either duplicated by the new API, or
still being called by code that should be migrated.

This document describes what is dead and a safe removal sequence.

---

## Inventory

### A. `mee6/web/routes/pipelines.py` — 3 routes are duplicate mutations

| Route | Status | Duplicate in |
|---|---|---|
| `GET /pipelines` | **KEEP** — renders the list page | — |
| `GET /pipelines/new` | **KEEP** — renders the editor page | — |
| `GET /pipelines/{id}` | **KEEP** — renders the editor page | — |
| `POST /pipelines` | DEAD | `api/pipelines.py:create_pipeline` |
| `POST /pipelines/{id}` | DEAD | `api/pipelines.py:update_pipeline` |
| `POST /pipelines/{id}/delete` | ACTIVE (called by `pipelines.html` form) | `api/pipelines.py:delete_pipeline` |
| `POST /api/agents/{type}/fields` | DEAD | `api/agents.py:render_agent_fields` |

Also dead in the same file:
- `class PipelineCreateRequest` (lines 25–27) — identical copy of the one in `api/models.py`
- `class AgentFieldsRequest` (lines 136–138) — duplicate of the one in `api/agents.py`

### B. `mee6/web/api/agents.py` — 1 HTML endpoint is dead

| Route | Status | Reason |
|---|---|---|
| `GET /api/v1/agents` | **KEEP** | |
| `GET /api/v1/agents/fields/batch` | **KEEP** | Called by `api-client.js:fetchSchemas` |
| `GET /api/v1/agents/{type}/fields` | **KEEP** | JSON schema, used by JS editor |
| `POST /api/v1/agents/{type}/fields` | DEAD | HTML renderer; new JS editor never calls this |

Also dead:
- `class AgentFieldsRequest` in `api/agents.py` (lines 18–22) — only used by the dead POST endpoint
- `from fastapi.responses import HTMLResponse` import in `api/agents.py` — only needed by the dead POST endpoint
- `from mee6.web.templates_env import templates` import in `api/agents.py` — same

### C. `mee6/web/static/js/modules/api-client.js` — wrong endpoints

The JS API client was never updated to call the new `/api/v1/` endpoints:

| Function | Current URL | Correct URL | HTTP method |
|---|---|---|---|
| `fetchPipeline(id)` | `GET /pipelines/${id}` — returns **HTML**, not JSON | `GET /api/v1/pipelines/${id}` | GET |
| `createPipeline` | `POST /pipelines` | `POST /api/v1/pipelines` | POST |
| `updatePipeline` | `POST /pipelines/${id}` | `PUT /api/v1/pipelines/${id}` | PUT |

`fetchPipeline` is additionally broken: `GET /pipelines/{id}` returns a full HTML page
(it's the editor route), so `response.json()` would throw. The editor currently receives
pipeline data via `initial_pipeline_json` baked into the template, so `fetchPipeline`
is never actually called — but it should be fixed to point at the JSON API.

### D. `mee6/web/api/models.py` — dead and anticipatory models

**Dead from the refactor (no endpoint uses these):**

| Model | Type | Reason |
|---|---|---|
| `TriggerResponse` | response | Stale shape — will be replaced in triggers refactor |
| `TriggerCreateRequest` | request | Same |

**Anticipatory (written speculatively for future APIs, no endpoint exists yet):**

These are not dead from the refactor — they have no corresponding endpoint yet.
Keep or remove based on whether those integrations are planned soon.

| Model | For future feature |
|---|---|
| `RunRecordResponse` | History/Dashboard JSON API |
| `RunningCountResponse` | Dashboard JSON API |
| `WhatsAppStatusResponse` | WhatsApp integration JSON API |
| `WhatsAppGroupResponse` | WhatsApp integration JSON API |
| `WhatsAppPhoneRequest` | WhatsApp integration JSON API |
| `CalendarResponse` | Google Calendar JSON API |
| `CalendarCreateRequest` | Google Calendar JSON API |
| `MemoryConfigResponse` | Memory configuration JSON API |
| `MemoryConfigRequest` | Memory configuration JSON API |

### E. `mee6/web/api/validation.py` — unused validators

| Validator | Status | Reason |
|---|---|---|
| `PipelineCreateRequestEnhanced` | **KEEP** | Will be used in pipeline API hardening |
| `TriggerCreateRequestEnhanced` | **KEEP** | Will be used in triggers refactor Phase 1 |
| `MemoryConfigRequestEnhanced` | **KEEP** | Will be used in memory API |
| `PipelineNameValidator` | DEAD | Not wired to any endpoint; only tested |
| `StepConfigValidator` | DEAD | Empty stub; not wired to any endpoint, not tested |

### F. `mee6/web/templates/` — dead template

| Template | Status | Reason |
|---|---|---|
| `_agent_fields.html` | DEAD | Only used by dead HTML agent-fields POST endpoint |

### G. `mee6/web/routes/pipelines.py.backup` — leftover backup file

Should be deleted.

### H. Tests that cover dead routes

In `tests/test_web_routes.py`:

| Test | Covers | Status |
|---|---|---|
| `test_create_pipeline_saves_steps` | `POST /pipelines` | DEAD — old route |
| `test_create_pipeline_multi_step_indices` | `POST /pipelines` | DEAD — old route |
| `test_update_pipeline_replaces_steps` | `POST /pipelines/{id}` | DEAD — old route |
| `test_agent_fields_endpoint_returns_html` | `POST /api/agents/{type}/fields` | DEAD — old route |
| `test_agent_fields_unknown_agent_returns_empty` | `POST /api/agents/{type}/fields` | DEAD — old route |

Equivalent coverage already exists in `tests/test_api.py` for the new JSON API.

---

## Removal sequence

Order matters. Work top to bottom to avoid breaking the running app at any point.

### Step 1 — Trivially safe deletions (no behavior change)

1. Delete `mee6/web/routes/pipelines.py.backup`
2. Remove `class StepConfigValidator` from `validation.py` and its export from `__init__.py`
3. Remove `class PipelineNameValidator` from `validation.py` and its export from `__init__.py`,
   and remove the two corresponding tests from `tests/test_api.py`
   (`test_pipeline_name_validator_valid`, `test_pipeline_name_validator_empty`,
   `test_pipeline_name_validator_too_long`)

Run `uv run pytest` — same pass/fail count.

### Step 2 — Migrate `api-client.js` to `/api/v1/` endpoints

Update `mee6/web/static/js/modules/api-client.js`:

- `fetchPipeline(id)`: change URL to `` `/api/v1/pipelines/${id}` `` (GET, already returns JSON)
- `createPipeline`: change URL to `/api/v1/pipelines`, method stays POST
- `updatePipeline`: change URL to `` `/api/v1/pipelines/${pipeline.id}` ``, method changes from POST to PUT

After this step the old mutation routes in `routes/pipelines.py` (`POST /pipelines`,
`POST /pipelines/{id}`) receive zero traffic.

Run `uv run pytest` — same pass/fail count (those routes are still registered, tests
in `test_web_routes.py` still call them directly via `client.post`).

### Step 3 — Migrate delete in `pipelines.html` from form POST to fetch

Replace the `<form method="post" action="/pipelines/{{ p.id }}/delete">` in
`mee6/web/templates/pipelines.html` with a small inline JS `fetch()` call:

```html
<button
  class="sm danger"
  onclick="if(confirm('Delete pipeline {{ p.name }}?')) {
    fetch('/api/v1/pipelines/{{ p.id }}', { method: 'DELETE' })
      .then(r => r.ok ? location.reload() : r.json().then(d => alert(d.detail)));
  }">Delete</button>
```

After this, `POST /pipelines/{id}/delete` also receives zero traffic.

### Step 4 — Remove dead mutation routes from `routes/pipelines.py`

Remove from `mee6/web/routes/pipelines.py`:
- `class PipelineCreateRequest` (lines 25–27) — import from `api/models.py` if needed
- `async def create_pipeline` (`POST /pipelines`)
- `async def update_pipeline` (`POST /pipelines/{id}`)
- `async def delete_pipeline` (`POST /pipelines/{id}/delete`)
- `class AgentFieldsRequest` (lines 136–138)
- `async def get_agent_fields` (`POST /api/agents/{type}/fields`)

Clean up imports that are no longer needed:
- `import urllib.parse` (only used by the delete redirect)
- `import uuid` (only used by create)
- `TriggerRepository` from the import (only used by old delete)
- `PipelineStepRepository`, `PipelineStepRow` (only used by old create/update)

Remove corresponding dead tests from `tests/test_web_routes.py`:
- `test_create_pipeline_saves_steps`
- `test_create_pipeline_multi_step_indices`
- `test_update_pipeline_replaces_steps`
- `test_agent_fields_endpoint_returns_html`
- `test_agent_fields_unknown_agent_returns_empty`

Run `uv run pytest` — same pass/fail count minus the removed tests.

### Step 5 — Remove dead HTML endpoint from `api/agents.py`

Remove from `mee6/web/api/agents.py`:
- `class AgentFieldsRequest`
- `async def render_agent_fields` (`POST /{type}/fields`)
- `from fastapi.responses import HTMLResponse` import
- `from mee6.web.templates_env import templates` import
- `from mee6.pipelines.placeholders import AVAILABLE as PLACEHOLDER_HINTS` import
  (verify it's not used elsewhere in that file first)

Delete `mee6/web/templates/_agent_fields.html`.

Run `uv run pytest` — same pass/fail count.

### Step 6 — Remove stale trigger models from `api/models.py`

`TriggerResponse` and `TriggerCreateRequest` will be **replaced** (not just deleted) as
part of triggers refactor Phase 1. Do not remove them here — do it there.

For the anticipatory models (`RunRecordResponse`, `RunningCountResponse`,
`WhatsAppStatusResponse`, `WhatsAppGroupResponse`, `CalendarResponse`,
`MemoryConfigResponse`, `WhatsAppPhoneRequest`, `CalendarCreateRequest`,
`MemoryConfigRequest`): remove them only if there is no near-term plan to build those
JSON API endpoints. If those features are still planned, leave them.

Also clean up `mee6/web/api/__init__.py`: remove exports of any models removed above.

---

## What NOT to do

- Do not remove `GET /pipelines`, `GET /pipelines/new`, `GET /pipelines/{id}` from
  `routes/pipelines.py` — these are still the HTML page entry points
- Do not remove `TriggerResponse` or `TriggerCreateRequest` here — they are replaced
  in triggers refactor Phase 1
- Do not remove the "Enhanced" validators — they are used in tests and will be wired to
  API endpoints
- Do not touch `mee6/web/routes/triggers.py` — that is Phase 1–4 of the triggers refactor
