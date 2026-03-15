# Refactor: Integrations Page — Consistency with Pipeline Editor

## Context

The integrations page (`/integrations`) and its sub-pages (`/integrations/memories`,
`/integrations/memories/new`) still use the old pattern: all mutations are `<form
method="post">` submissions that cause full-page 303 redirects. WhatsApp status polling
uses HTMX. There is no JSON API.

Target: same patterns as the pipeline editor and triggers pages.

- No inline JS anywhere in templates
- No HTMX
- All mutations backed by a JSON API under `/api/v1/integrations/`
- All logic in ES modules under `mee6/web/static/js/`
- In-place DOM updates (no full-page reloads)

---

## What Exists and What It Does

### Routes — `mee6/web/routes/integrations.py`

**GET (keep all of these):**
- `GET /integrations` — main page (renders `integrations.html`)
- `GET /integrations/whatsapp/status` — HTMX polling partial (renders `_whatsapp_status.html`)
- `GET /integrations/memories` — memory list (renders `memories.html`)
- `GET /integrations/memories/new` — new memory form (renders `new_memory.html`) — remove in Phase 4
- `GET /integrations/memories/api` — returns JSON array of memory labels for pipeline editor
- `GET /integrations/calendars` — **dead** (renders `calendars.html` which does not exist)

**POST (all become dead after Phase 4):**
- `POST /integrations/whatsapp/connect`
- `POST /integrations/whatsapp/status` — **dead** (no form in any template calls this; `set_enabled()` is unconnected to UI)
- `POST /integrations/whatsapp/phone`
- `POST /integrations/whatsapp/sync`
- `POST /integrations/whatsapp/groups/{jid}/label`
- `POST /integrations/calendars` — create calendar
- `POST /integrations/calendars/{cal_id}/delete`
- `POST /integrations/memories` — create memory config
- `POST /integrations/memories/{label}/delete`

**Missing endpoint (referenced in template, does not exist):**
- `POST /integrations/whatsapp/test` — referenced by `hx-post` in `_whatsapp_status.html`

**Missing group delete route** (form exists in `integrations.html` line 51, no matching route):
- `POST /integrations/whatsapp/groups/{jid}/delete`

### Templates

**`integrations.html` (100 lines):**
- WhatsApp section: includes `_whatsapp_status.html` partial, phone number form
- Memory section: link to `/integrations/memories`
- WhatsApp Groups section: table with per-row label form + delete form, sync button at bottom
- Google Calendar section: table with per-row delete form, add calendar form
- No inline JS, no `<script>` block

**`_whatsapp_status.html` (38 lines):**
- Polling div: `hx-get="/integrations/whatsapp/status"` `hx-trigger="every 2s"` `hx-swap="outerHTML"` — only active while status is transitional
- States rendered server-side: `pending_qr` (shows QR SVG), `disconnected`/`error` (connect button), `connecting` (spinner text), `connected` (connected message + test form)
- Test form uses HTMX: `hx-post="/integrations/whatsapp/test"` `hx-target="#test-result"` (endpoint missing)

**`memories.html` (61 lines):**
- Table of memory configs with per-row delete form (inline `onclick="return confirm(...)"`)
- `+ New Memory` button uses `onclick="window.location='/integrations/memories/new'"`
- Dead `<script>` block at bottom: `deleteMemory()` function is defined but never called

**`new_memory.html` (46 lines):**
- Standalone form page for creating a memory config
- Fields: label, max_memories, ttl_hours, max_value_size
- `POST /integrations/memories` action

### Models and Validation — already in place

**`mee6/web/api/models.py`** (all correct, no replacements needed):
- `WhatsAppStatusResponse(connected: bool, phone: str)` — needs expansion (see Phase 1)
- `WhatsAppGroupResponse(name: str, jid: str)`
- `CalendarResponse(id: str, label: str, calendar_id: str)`
- `MemoryConfigResponse(label: str, max_memories: int, ttl_hours: int, max_value_size: int)`
- `WhatsAppPhoneRequest(phone: str)`
- `CalendarCreateRequest(label: str, calendar_id: str, credentials_file: str)` — note: `credentials_file` is read from `settings.google_credentials_file` server-side, not supplied by the user form; this field should be removed or made optional
- `MemoryConfigRequest(label: str, max_memories: int, ttl_hours: int, max_value_size: int)`

**`mee6/web/api/validation.py`**:
- `MemoryConfigRequestEnhanced` — fully correct, ready to use

**Missing request models** (add in Phase 1):
- `WhatsAppGroupLabelRequest(label: str)`
- `WhatsAppTestRequest(phone: str)`

---

## Bugs to Fix During Refactor

1. **Missing `/whatsapp/test` endpoint** — `_whatsapp_status.html` calls it via HTMX but it doesn't exist. Add it in Phase 1 as a JSON endpoint.
2. **Sync URL mismatch** — `integrations.html` line 62 posts to `/integrations/whatsapp/groups/sync` but the route is `/integrations/whatsapp/sync`. Fix in Phase 3 when removing forms.
3. **Missing group delete route** — `integrations.html` line 51 posts to `/integrations/whatsapp/groups/{jid}/delete` but no such route exists. Add `DELETE /groups/{jid}` in Phase 1 API.
4. **Dead `POST /whatsapp/status` route** — no template sends to it. Remove in Phase 4.
5. **Dead `GET /integrations/calendars` route** — references non-existent `calendars.html`. Remove in Phase 4.
6. **Dead `deleteMemory()` function** in `memories.html` — defined but never called. Remove in Phase 4.
7. **Dead `new_memory.html` page** — replace with inline form on `memories.html`. Remove in Phase 4.
8. **Duplicate import** in `routes/integrations.py` — `from mee6.scheduler.engine import scheduler` appears at module level (line 17) and again inside `connect_whatsapp` (line 71). Remove inner import in Phase 4.

---

## Phases

### Phase 1 — JSON API (`mee6/web/api/integrations.py`)

New file. One router, three logical sections.

**Register in `app.py`:**
```python
from mee6.web.api import integrations as api_integrations
app.include_router(api_integrations.router, prefix="/api/v1/integrations")
```

**WhatsApp endpoints** (`/api/v1/integrations/whatsapp/…`):

```
GET  /whatsapp/status
     → { status, qr_svg, error, notify_phone }
     WA status values: disconnected | connecting | pending_qr | connected | error
     qr_svg: SVG string or null

POST /whatsapp/connect
     → 204 No Content

POST /whatsapp/phone          body: WhatsAppPhoneRequest
     → 204 No Content

POST /whatsapp/sync
     → { updated: int, message: str }

GET  /whatsapp/groups
     → list[WhatsAppGroupResponse]

PATCH /whatsapp/groups/{jid}/label   body: WhatsAppGroupLabelRequest
     → 204 No Content

DELETE /whatsapp/groups/{jid}
     → 204 No Content

POST /whatsapp/test            body: WhatsAppTestRequest
     → { ok: bool }
     Calls wa.send_notification(phone=..., message="Test message from mee6")
     Returns 503 if WhatsApp is not connected
```

**Calendar endpoints** (`/api/v1/integrations/calendars/…`):

```
GET  /calendars
     → list[CalendarResponse]

POST /calendars                body: { label, calendar_id }
     credentials_file read from settings.google_credentials_file server-side
     → CalendarResponse (201)

DELETE /calendars/{cal_id}
     → 204 No Content
```

`CalendarCreateRequest` has a `credentials_file` field that the user never supplies. Either:
- Remove `credentials_file` from `CalendarCreateRequest` and set it server-side in the API handler
- Or create a separate `CalendarCreateFromFormRequest(label, calendar_id)` for the API

Recommend: update `CalendarCreateRequest` to remove `credentials_file` (it was only needed when the route was an HTML form handler that set it explicitly). Set it from `settings` inside the API handler.

**Memory endpoints** (`/api/v1/integrations/memories/…`):

```
GET  /memories
     → list[MemoryConfigResponse + count field]
     Fetch configs + entry counts in one response

POST /memories                 body: MemoryConfigRequestEnhanced
     → MemoryConfigResponse (201)
     Use MemoryConfigRequestEnhanced for validation (already in validation.py)

DELETE /memories/{label}
     → 204 No Content
```

Also: move the existing `/integrations/memories/api` JSON endpoint (returns memory label
list for pipeline editor) to the new router as `GET /memories/labels` → `list[str]`.
Update any JS that calls `/integrations/memories/api` to call the new URL.

**Existing models to update:**

`WhatsAppStatusResponse` currently has `connected: bool` and `phone: str`. The API needs
richer status. Replace or extend to:
```python
class WhatsAppStatusResponse(BaseModel):
    status: str          # disconnected | connecting | pending_qr | connected | error
    qr_svg: Optional[str]
    error: Optional[str]
    notify_phone: str
```

`MemoryConfigResponse` needs a `count` field for the list endpoint:
```python
class MemoryConfigResponse(BaseModel):
    ...
    count: int = 0
```

**New request models to add to `models.py`:**
```python
class WhatsAppGroupLabelRequest(BaseModel):
    label: str

class WhatsAppTestRequest(BaseModel):
    phone: str
```

---

### Phase 2 — JS Modules

**New directory:** `mee6/web/static/js/modules/integrations/`

**Files:**

`api-client.js` — fetch wrappers for all API endpoints
```javascript
export async function getWhatsAppStatus()     // GET /api/v1/integrations/whatsapp/status
export async function connectWhatsApp()       // POST .../connect
export async function setPhone(phone)         // POST .../phone
export async function syncGroups()            // POST .../sync
export async function getGroups()             // GET .../groups
export async function updateGroupLabel(jid, label)  // PATCH .../groups/{jid}/label
export async function deleteGroup(jid)        // DELETE .../groups/{jid}
export async function testWhatsApp(phone)     // POST .../test
export async function getCalendars()          // GET .../calendars
export async function createCalendar(label, calendarId)
export async function deleteCalendar(id)      // DELETE .../calendars/{id}
export async function getMemories()           // GET .../memories
export async function createMemory(data)      // POST .../memories
export async function deleteMemory(label)     // DELETE .../memories/{label}
```

`whatsapp-section.js` — WhatsApp card logic
- `initWhatsApp(container, apiClient)` — entry point for the section
- Status polling: `startPolling()` / `stopPolling()` using `setInterval` at 2s
  - Polls `getWhatsAppStatus()`
  - Stops when status is `connected`, `disconnected`, or `error`
  - Updates `#wa-status-badge`, shows/hides QR div (set `innerHTML` to `qr_svg`), shows/hides connect button
- Handlers: connect, save phone, sync groups, update group label, delete group, send test

`calendars-section.js` — Calendar section logic
- `initCalendars(container, apiClient)` — entry point
- Handlers: add calendar (validate label + calendar_id client-side), delete with confirm

`memories-section.js` — Memories page logic
- `initMemories(container, apiClient)` — entry point
- Handlers: create memory (validate label client-side using same rules as `MemoryConfigRequestEnhanced`), delete with confirm, add row / remove row in-place

`validator.js` — client-side field validation
- Memory label: non-empty, ≤50 chars, `^[a-zA-Z0-9_-]+$`
- Phone: non-empty for test/phone forms
- Calendar fields: non-empty label + calendar_id

**Entry point:** `mee6/web/static/js/integrations-editor.js`
```javascript
import * as apiClient from './modules/integrations/api-client.js';
import { initWhatsApp } from './modules/integrations/whatsapp-section.js';
import { initCalendars } from './modules/integrations/calendars-section.js';
import { initMemories } from './modules/integrations/memories-section.js';

export function initializeIntegrationsPage() { ... }
export function initializeMemoriesPage() { ... }
```

The integrations page and memories page are separate, so the entry point exports two
initializers. Each template calls only its relevant one.

---

### Phase 3 — Template Switchover

**`integrations.html`:**
- Remove all `<form method="post">` elements
- Remove HTMX from `_whatsapp_status.html` (keep the template for server-side initial render, remove `hx-get`, `hx-trigger`, `hx-swap` attributes; JS takes over polling)
- Add `id` and `data-action` / `data-jid` / `data-cal-id` attributes for JS to target
- Add entry point at bottom:
  ```html
  <script type="module">
    import { initializeIntegrationsPage } from '/static/js/integrations-editor.js';
    initializeIntegrationsPage();
  </script>
  ```
- Add `id="action-banner"` and `id="form-errors"` divs (consistent with triggers page)

**`memories.html`:**
- Remove `<form method="post">` delete forms
- Remove `onclick="return confirm(...)"` inline handlers
- Remove dead `<script>` block with `deleteMemory()`
- Replace `+ New Memory` button's `onclick=window.location=...` with inline create form (eliminates `new_memory.html` entirely)
- Add data-action attributes for JS
- Add entry point script tag

**`_whatsapp_status.html`:**
- Remove `hx-get`, `hx-trigger`, `hx-swap` from the root div
- Remove `hx-post`, `hx-target`, `hx-swap` from the test form
- Keep conditional rendering for initial server-side state (status badge, QR div placeholder) — JS overlays from there
- The QR div: `<div id="qr-wrap"></div>` — JS sets innerHTML when status is `pending_qr`

**URL to check:** Pipeline editor calls `/integrations/memories/api` to fetch memory
labels. After Phase 1, this moves to `/api/v1/integrations/memories/labels`. Update the
JS file that makes this call (search for `memories/api` in the static JS files).

---

### Phase 4 — Cleanup (`routes/integrations.py`)

**Remove routes:**
- `GET /integrations/whatsapp/status` — HTMX polling partial no longer needed
- `POST /integrations/whatsapp/connect`
- `POST /integrations/whatsapp/status` — was dead already
- `POST /integrations/whatsapp/phone`
- `POST /integrations/whatsapp/sync`
- `POST /integrations/whatsapp/groups/{jid}/label`
- `GET /integrations/calendars` — dead (no `calendars.html`)
- `POST /integrations/calendars`
- `POST /integrations/calendars/{cal_id}/delete`
- `GET /integrations/memories/new`
- `GET /integrations/memories/api` — moved to API router
- `POST /integrations/memories`
- `POST /integrations/memories/{label}/delete`

**Keep routes:**
- `GET /integrations` — main page
- `GET /integrations/memories` — memories page

**Remove imports** from `routes/integrations.py` that are only needed by removed routes:
- `Form` (from fastapi)
- `urllib.parse`
- `uuid`
- `CalendarRow`, `WhatsAppGroupRow` (from db.models)
- `CalendarRepository`, `WhatsAppGroupRepository`, `WhatsAppSettingsRepository` (from db.repository)
- `select` (from sqlalchemy)
- `scheduler` (from scheduler.engine)
- `MemoryRow`, `MemoryEntryRow` (if any)
- `MemoryRepository` (if any)
- Inner `from mee6.scheduler.engine import scheduler` inside `connect_whatsapp` (already dead)

**Remove templates:**
- `new_memory.html` — form inlined into `memories.html` in Phase 3

---

## Modified Files Summary

| File | Action |
|---|---|
| `mee6/web/api/integrations.py` | **Create** — new JSON API router |
| `mee6/web/api/models.py` | **Update** — expand `WhatsAppStatusResponse`, add `count` to `MemoryConfigResponse`, add `WhatsAppGroupLabelRequest` + `WhatsAppTestRequest`, remove `credentials_file` from `CalendarCreateRequest` |
| `mee6/web/api/__init__.py` | **Update** — export new models and `api_integrations` router |
| `mee6/web/app.py` | **Update** — register `api_integrations.router` at `/api/v1/integrations` |
| `mee6/web/routes/integrations.py` | **Trim** — remove all POST handlers, keep two GET handlers |
| `mee6/web/templates/integrations.html` | **Update** — remove forms, add data-action attrs, add script tag |
| `mee6/web/templates/_whatsapp_status.html` | **Update** — remove HTMX attrs, add IDs for JS targeting |
| `mee6/web/templates/memories.html` | **Update** — remove forms, remove dead script block, inline create form |
| `mee6/web/templates/new_memory.html` | **Delete** |
| `mee6/web/static/js/modules/integrations/api-client.js` | **Create** |
| `mee6/web/static/js/modules/integrations/whatsapp-section.js` | **Create** |
| `mee6/web/static/js/modules/integrations/calendars-section.js` | **Create** |
| `mee6/web/static/js/modules/integrations/memories-section.js` | **Create** |
| `mee6/web/static/js/modules/integrations/validator.js` | **Create** |
| `mee6/web/static/js/integrations-editor.js` | **Create** — entry point |
| `mee6/web/static/js/pipeline-editor.js` (or modules) | **Update** — change `/integrations/memories/api` call to `/api/v1/integrations/memories/labels` |
| `tests/test_api_integrations.py` | **Create** — API endpoint tests |
| `tests/test_web_routes.py` | **Update** — remove stale integration route tests if any |

---

## Out of Scope

- Redesigning the integrations page layout or information architecture
- Moving calendars to a separate page (currently inline in `integrations.html`, keep it that way)
- Adding WhatsApp `enabled` toggle UI (the backend has `set_enabled()` but it was never exposed in the UI; leave it out)
- JS module reorganization of the existing pipeline editor modules
- Any changes to the integration backend logic (`whatsapp.py`, `whatsapp_session.py`, `calendar.py`)

---

## Test Coverage

`tests/test_api_integrations.py` — follow the same structure as `test_api_triggers.py`:

- WhatsApp status: returns correct shape
- WhatsApp connect: returns 204
- WhatsApp phone: saves phone, returns 204
- WhatsApp sync: returns `{updated, message}`; error case returns message
- WhatsApp groups: list, label update (204), delete (204), 404 for unknown jid
- WhatsApp test: returns `{ok: true}`; 503 when not connected
- Calendars: list, create (201), delete (204), 404 for unknown id
- Memories: list (with count), create (201), delete (204), 422 for invalid label

JS tests for each module under `tests/js/integrations/` — same pattern as `tests/js/triggers/`.
