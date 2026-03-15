# Refactor: Triggers Page — Consistency with Pipeline Editor

## Context

The pipeline editor was refactored across 8 phases, removing 260 lines of inline JS
from `pipeline_editor.html` and replacing them with a 19-module ES module system.
The triggers page (`triggers.html`) still uses the old pattern:

- One `<script>` block (10 lines, `onTriggerTypeChange` + initialization call)
- Inline `onchange` handler on the trigger type `<select>`
- Inline `onclick="return confirm(...)"` on the delete button
- All four mutating actions (add, toggle, run-now, delete) use `<form method="post">`
  with full-page 303 redirects — no fetch()

Target: same patterns as the pipeline editor.
- No inline JS anywhere in `triggers.html`
- All logic in ES modules under `mee6/web/static/js/`
- A JSON API backing all four actions (mirroring `mee6/web/api/pipelines.py`)
- Validation before submit (no trip to the server for invalid input)
- In-place DOM updates for toggle/run-now/delete (no full-page reload)

---

## What Exists and What It Does

### triggers.html (120 lines total)

**Inline script (lines 53–63):**
```javascript
function onTriggerTypeChange(type) {
  document.getElementById('field-cron').classList.toggle('hidden', type !== 'cron');
  document.getElementById('field-whatsapp').classList.toggle('hidden', type !== 'whatsapp');
  document.getElementById('field-wa-group').classList.toggle('hidden', type !== 'wa_group');
  document.getElementById('cron_expr').required = type === 'cron';
  document.getElementById('phone').required = type === 'whatsapp';
  document.getElementById('group_jid').required = type === 'wa_group';
}
onTriggerTypeChange('cron');
```

Note: this `<script>` block is inside `{% if pipelines %}` — it is only rendered when
at least one pipeline exists. The entry point JS must also initialise conditionally.

**Inline event handlers:**
- Line 23: `onchange="onTriggerTypeChange(this.value)"` on trigger type `<select>`
- Line 108: `onclick="return confirm('Delete this trigger?')"` on delete button

**Form actions (all cause full-page reloads):**
- Add trigger: `<form method="post" action="/triggers">`
- Toggle: `<form method="post" action="/triggers/{{ job.id }}/toggle">`
- Run now: `<form method="post" action="/triggers/{{ job.id }}/run-now">`
- Delete: `<form method="post" action="/triggers/{{ job.id }}/delete">`

**Conditional fields (3 trigger types):**
- `cron`: shows `#field-cron` (cron expression text input)
- `whatsapp`: shows `#field-whatsapp` (phone tel input)
- `wa_group`: shows `#field-wa-group` (group_jid select, server-rendered from DB)

**Enabled checkbox:**
- `<input type="checkbox" name="enabled" value="true">` — unchecked by default
- When unchecked the field is not submitted; the form route defaults `enabled=False`
- JS must read `.checked` on the checkbox, not `.value`

**Server-rendered data passed to template:**
- `jobs` — list of `TriggerMeta` objects (id, pipeline_name, trigger_type, cron_expr, config, enabled)
- `pipelines` — list of `Pipeline` objects for the add form dropdown
- `wa_groups` — list of `WhatsAppGroupRow` (jid, name) for the group selector
- `TriggerType` — the enum class, used for type comparisons in template

### routes/triggers.py (74 lines)

- `GET /triggers` — renders template with jobs, pipelines, wa_groups, TriggerType
- `POST /triggers` — creates trigger from Form fields, redirects 303
- `POST /triggers/{id}/toggle` — toggles enabled, redirects 303
- `POST /triggers/{id}/run-now` — runs immediately, redirects 303
- `POST /triggers/{id}/delete` — removes trigger, redirects 303

### TriggerRow (db/models.py)

| Field | Type | Notes |
|---|---|---|
| id | String PK | UUID |
| pipeline_id | String | FK to pipelines |
| trigger_type | String | "cron" \| "whatsapp" \| "wa_group" |
| cron_expr | String nullable | Only for cron type |
| config | JSONB nullable | `{"phone": "+34..."}` or `{"group_jid": "120...@g.us"}` |
| enabled | Boolean | |

### TriggerType enum (scheduler/engine.py)
```python
class TriggerType(str, Enum):
    CRON = "cron"
    WHATSAPP = "whatsapp"
    WA_GROUP = "wa_group"
```

### Stale models that need replacement before Phase 1 can proceed

`mee6/web/api/models.py` already contains `TriggerResponse` and `TriggerCreateRequest`
but with the wrong field shapes (e.g. `job_id` instead of `id`, `name` field that
doesn't exist on `TriggerMeta`, `cron_expression` instead of `cron_expr`).

`mee6/web/api/validation.py` already contains `TriggerCreateRequestEnhanced` but it
validates `trigger_type` against `["cron", "whatsapp", "manual"]` — "manual" is wrong,
the real type is "wa_group".

These are replaced (not added to) in Phase 1. See `prompts/triggers-phase1.md` for the
exact replacement code.

---

## Target Architecture

### New files

```
mee6/web/api/triggers.py                           ← JSON API (new)
mee6/web/static/js/triggers-editor.js             ← entry point (new)
mee6/web/static/js/modules/triggers/
  api-client.js                                    ← fetch wrappers (new)
  event-handlers.js                                ← business logic functions (new)
  event-delegation.js                              ← DOM event wiring (new)
  validator.js                                     ← form validation (new)
tests/js/triggers/
  api-client.test.js
  event-handlers.test.js
  event-delegation.test.js
  validator.test.js
tests/test_api_triggers.py
```

### Modified files

```
mee6/web/api/models.py        replace stale TriggerResponse and TriggerCreateRequest
mee6/web/api/validation.py    replace stale TriggerCreateRequestEnhanced
mee6/web/api/__init__.py      add triggers router and corrected models to exports
mee6/web/app.py               register api_triggers.router with prefix /api/v1/triggers
mee6/web/templates/triggers.html   remove all inline JS, add module script tag
```

### Unchanged

```
mee6/web/routes/triggers.py   keep GET /triggers (HTML page); POST routes stay until Phase 4
mee6/scheduler/engine.py      no changes
mee6/db/models.py             no changes
mee6/db/repository.py         no changes
```

The existing `POST /triggers` and `POST /triggers/{id}/*` form routes stay in
`routes/triggers.py` until Phase 4; they are no longer called by the frontend after
Phase 3 but kept for a safe rollback window.

---

## Phase 1 — JSON API (`mee6/web/api/triggers.py`)

Full step-by-step implementation is in `prompts/triggers-phase1.md`. Summary:

### Models — replace stale versions in `mee6/web/api/models.py`

```python
class TriggerResponse(BaseModel):
    """Response model for a trigger, built from TriggerMeta."""
    id: str
    pipeline_id: str
    pipeline_name: str
    trigger_type: str           # "cron" | "whatsapp" | "wa_group"
    cron_expr: Optional[str]
    config: dict
    enabled: bool

class TriggerCreateRequest(BaseModel):
    """Request model for trigger creation."""
    pipeline_id: str
    trigger_type: str
    cron_expr: Optional[str] = None
    phone: Optional[str] = None
    group_jid: Optional[str] = None
    enabled: bool = True
```

Remove the `name` field — triggers have no name, they are identified by pipeline + type.

### Validator — replace stale `TriggerCreateRequestEnhanced` in `mee6/web/api/validation.py`

Replace `["cron", "whatsapp", "manual"]` with `["cron", "whatsapp", "wa_group"]` and
add a `@model_validator` that cross-checks type-specific required fields:
- `cron` → `cron_expr` required
- `whatsapp` → `phone` required
- `wa_group` → `group_jid` required

### Endpoints

| Method | Path | Description | Returns |
|--------|------|-------------|---------|
| `POST` | `/api/v1/triggers` | Create trigger | `TriggerResponse` 201 |
| `POST` | `/api/v1/triggers/{id}/toggle` | Toggle enabled | `{"id": str, "enabled": bool}` |
| `POST` | `/api/v1/triggers/{id}/run-now` | Fire immediately | `{"ok": true}` |
| `DELETE` | `/api/v1/triggers/{id}` | Delete trigger | 204 No Content |

### Registration — `mee6/web/app.py`

Router registration belongs in `app.py` alongside the other API routers, NOT in
`__init__.py`:

```python
# app.py imports (line 14)
from mee6.web.api import agents, pipelines as api_pipelines, triggers as api_triggers

# app.py router registration (after existing API routes)
app.include_router(api_triggers.router, prefix="/api/v1/triggers")
```

`__init__.py` gets the new imports and exports added to keep it consistent:
```python
from mee6.web.api import agents, pipelines, triggers
```

### Tests (`tests/test_api_triggers.py`)

12 tests covering all four endpoints with a mocked scheduler:
- POST create — one test per trigger type (cron, whatsapp, wa_group)
- POST create — validation rejects missing cron_expr, missing phone, unknown type, empty pipeline_id
- POST toggle — returns new enabled state; 404 for unknown id
- POST run-now — calls run_now(); 404 for unknown id
- DELETE — 204 on success; 404 for unknown id

---

## Phase 2 — JS Modules

The triggers JS is simpler than the pipeline editor. There is no schema-driven field
rendering, no component registry, and no complex state. Four modules suffice.

### `mee6/web/static/js/modules/triggers/api-client.js` (≤ 60 lines)

```javascript
export async function createTrigger(data) { ... }      // POST /api/v1/triggers
export async function toggleTrigger(id) { ... }        // POST /api/v1/triggers/{id}/toggle
export async function runNow(id) { ... }               // POST /api/v1/triggers/{id}/run-now
export async function deleteTrigger(id) { ... }        // DELETE /api/v1/triggers/{id}
```

All functions throw on non-OK responses (same pattern as `modules/api-client.js`).
All POST/DELETE include `Content-Type: application/json`.

### `mee6/web/static/js/modules/triggers/validator.js` (≤ 60 lines)

```javascript
export function validateTriggerForm(formData) → string[]
// Returns array of error messages (empty = valid)
// Rules:
//   pipeline_id: must not be empty
//   type=cron: cron_expr must be non-empty (basic pattern check: 5 fields)
//   type=whatsapp: phone must be non-empty
//   type=wa_group: group_jid must be non-empty

export function displayErrors(errors) { ... }   // writes to #form-errors
export function clearErrors() { ... }           // clears #form-errors
```

No DOM state. Pure functions + targeted DOM feedback.

### `mee6/web/static/js/modules/triggers/event-handlers.js` (≤ 80 lines)

```javascript
export function handleTypeChange(type, fields) {
  // fields = { cron, whatsapp, waGroup } — DOM element refs
  // Show/hide + set required. Replaces onTriggerTypeChange().
}

export async function handleAdd(formData, apiClient) → { ok, trigger, error }
// Reads enabled from checkbox.checked (not .value)
// Calls validator, then apiClient.createTrigger()

export async function handleToggle(triggerId, apiClient) → { ok, enabled, error }
export async function handleRunNow(triggerId, apiClient) → { ok, error }
export async function handleDelete(triggerId, apiClient) → { ok, error }
```

### `mee6/web/static/js/modules/triggers/event-delegation.js` (≤ 80 lines)

```javascript
export function setupEventDelegation(container, form, apiClient, callbacks) { ... }
// Attaches listeners:
//   form 'submit' → prevent default → handleAdd → callbacks.onAdded(trigger) or onError(err)
//   container 'change' on #trigger_type → handleTypeChange
//   container 'click' on [data-action="toggle"] → handleToggle → callbacks.onToggled(id, enabled)
//   container 'click' on [data-action="run-now"] → handleRunNow → callbacks.onRan(id)
//   container 'click' on [data-action="delete"] → handleDelete → callbacks.onDeleted(id)

export function teardown() { ... }
```

### `mee6/web/static/js/triggers-editor.js` (≤ 80 lines)

Entry point. Receives config block from template. Wires everything together.

```javascript
import * as apiClient from './modules/triggers/api-client.js';
import * as handlers from './modules/triggers/event-handlers.js';
import { setupEventDelegation } from './modules/triggers/event-delegation.js';
import { esc } from './utils/esc.js';

export function initializeTriggerEditor(config) {
  // config = { pipelines, waGroups }
  // Only called when the add-trigger form exists (i.e. pipelines.length > 0)

  const triggerTypeEl = document.getElementById('trigger_type');
  const fields = {
    cron: document.getElementById('field-cron'),
    whatsapp: document.getElementById('field-whatsapp'),
    waGroup: document.getElementById('field-wa-group'),
  };
  handlers.handleTypeChange(triggerTypeEl.value, fields);

  const container = document.getElementById('triggers-container');
  const form = document.getElementById('add-trigger-form');
  const banner = document.getElementById('action-banner');

  setupEventDelegation(container, form, apiClient, {
    onAdded: (trigger) => { /* append row, clear form, show banner */ },
    onToggled: (id, enabled) => { /* update toggle button in place */ },
    onRan: (id) => { /* show "Pipeline queued" banner */ },
    onDeleted: (id) => { /* remove row from DOM */ },
    onError: (msg) => showBanner(banner, msg, 'error'),
  });
}
```

**DOM update helpers (private, in triggers-editor.js):**
- `renderTriggerRow(trigger)` — builds a `<tr>` HTML string using `esc()` for all values
- `showBanner(el, message, type)` — same pattern as pipeline-editor.js

---

## Phase 3 — Template Switchover (`triggers.html`)

### Changes

**Remove:**
- The entire `<script>` block (lines 53–63)
- `onchange="onTriggerTypeChange(this.value)"` attribute (line 23)
- `onclick="return confirm('Delete this trigger?')"` attribute (line 108)
- `method` and `action` attributes from the add trigger form
- The three action `<form>` wrappers in the table (replace with plain buttons)

**Add:**

Config block — emit only when pipelines exist (keep it inside `{% if pipelines %}`):
```html
<script>
  const TRIGGERS_CONFIG = {
    pipelines: {{ pipelines | tojson }},
    waGroups: {{ wa_groups | tojson(attribute=['jid','name']) }},
  };
</script>
```

Since `wa_groups` contains ORM objects, serialize in the route:
```python
# routes/triggers.py GET /triggers
"wa_groups_json": [{"jid": g.jid, "name": g.name or ""} for g in wa_groups],
```

Then in template: `waGroups: {{ wa_groups_json | tojson | safe }}`.

Module entry point (also inside `{% if pipelines %}`):
```html
<script type="module">
  import { initializeTriggerEditor } from '/static/js/triggers-editor.js';
  initializeTriggerEditor(TRIGGERS_CONFIG);
</script>
```

Feedback elements (outside `{% if pipelines %}`, always present):
```html
<div id="action-banner" style="display:none" class="save-banner"></div>
<div id="form-errors" class="validation-summary" style="display:none"></div>
```

**DOM attribute changes:**

Give the add form an id, remove method/action:
```html
<form id="add-trigger-form">
```

Replace the three action `<form>` elements per row with plain buttons:
```html
<button type="button" class="toggle {{ 'on' if job.enabled else '' }}"
        data-action="toggle" data-trigger-id="{{ job.id }}"
        title="{{ 'Disable' if job.enabled else 'Enable' }}"></button>

<button type="button" class="sm"
        data-action="run-now" data-trigger-id="{{ job.id }}">Run now</button>

<button type="button" class="sm danger"
        data-action="delete" data-trigger-id="{{ job.id }}">Delete</button>
```

Wrap the tbody and add an outer container id:
```html
<div id="triggers-container">
  ...
  <tbody id="triggers-list">
    {% for job in jobs %}
    <tr data-trigger-id="{{ job.id }}">
      ...
    </tr>
    {% endfor %}
  </tbody>
```

### Verification checklist for Phase 3

- [ ] No `<script>` block in template (other than config + module entry)
- [ ] No `on*=` attributes anywhere in template
- [ ] `type="module"` on the entry script tag
- [ ] All dynamic values in config block go through `| tojson` (never raw)
- [ ] `esc()` wraps all trigger field values rendered into table rows by JS
- [ ] Delete confirmation uses `window.confirm()` called from JS, not inline onclick
- [ ] `enabled` checkbox state read via `.checked`, not `.value`
- [ ] Add-form section (including config + module scripts) remains inside `{% if pipelines %}`

---

## Phase 4 — Cleanup

Once Phase 3 is verified working:

1. Remove from `routes/triggers.py`:
   - `POST /triggers` (create)
   - `POST /triggers/{id}/toggle`
   - `POST /triggers/{id}/run-now`
   - `POST /triggers/{id}/delete`
   - Now-unused imports: `Form`, `RedirectResponse` (keep `HTMLResponse`, `Request`)

2. Keep: `GET /triggers` — this is the HTML page route, always needed.

3. Run full test suite: `uv run pytest && npm test`

---

## Test coverage

### JS tests (`tests/js/triggers/`)

**`api-client.test.js`** (≤ 60 lines)
- createTrigger sends correct method, URL, headers, body
- toggleTrigger sends POST to correct URL
- runNow sends POST to correct URL
- deleteTrigger sends DELETE to correct URL
- Non-OK response throws with message

**`validator.test.js`** (≤ 80 lines)
- Empty pipeline_id → error
- Cron type, empty cron_expr → error
- Cron type, single field cron expr (too few fields) → error
- Cron type, valid 5-field expr → no error
- Whatsapp type, empty phone → error
- Whatsapp type, non-empty phone → no error
- wa_group type, empty group_jid → error
- wa_group type, non-empty group_jid → no error
- All fields valid → empty errors array
- displayErrors/clearErrors update DOM correctly

**`event-handlers.test.js`** (≤ 100 lines)
- handleTypeChange('cron', fields) — shows cron, hides others, sets required
- handleTypeChange('whatsapp', fields) — shows whatsapp, hides others, sets required
- handleTypeChange('wa_group', fields) — shows wa_group, hides others, sets required
- handleAdd with invalid form → returns error, does not call apiClient
- handleAdd with valid cron form → calls apiClient.createTrigger with correct data
- handleAdd with valid whatsapp form → config has phone key
- handleAdd reads enabled from checkbox.checked
- handleToggle → calls apiClient.toggleTrigger, returns enabled state
- handleRunNow → calls apiClient.runNow
- handleDelete → calls apiClient.deleteTrigger

**`event-delegation.test.js`** (≤ 100 lines)
- Form submit calls handleAdd and invokes onAdded callback on success
- Form submit calls onError callback on API failure
- Change on #trigger_type calls handleTypeChange
- Click on data-action="toggle" calls handleToggle
- Click on data-action="run-now" calls handleRunNow
- Click on data-action="delete" calls handleDelete (after confirm)
- teardown() prevents subsequent events from firing

### Python API tests (`tests/test_api_triggers.py`)

Covered in Phase 1 / `prompts/triggers-phase1.md`.

---

## Phase sequence

```
Phase 1: JSON API          mee6/web/api/triggers.py + model replacements + Python tests
                           Detail: prompts/triggers-phase1.md
                           Run: uv run pytest tests/test_api_triggers.py

Phase 2: JS modules        modules/triggers/ (4 files) + tests/js/triggers/ (4 files)
                           Run: npm test

Phase 3: Template          triggers.html switchover + routes/triggers.py wa_groups_json
                           Verify manually: add trigger, toggle, run-now, delete

Phase 4: Cleanup           Remove POST form routes from routes/triggers.py
                           Run: uv run pytest && npm test
```

Each phase is independently testable. Phase 3 (template) can be rolled back by
reverting `triggers.html`; phases 1 and 2 leave the existing page fully functional.

---

## Scope boundaries

**In scope:**
- Remove all inline JS from triggers.html
- Add JSON API for all four mutating actions
- In-place DOM updates (no full-page reload)
- Validation before submit
- Consistent module/test structure with pipeline editor

**Out of scope:**
- Editing an existing trigger (no edit form exists today)
- Real-time trigger status updates (polling for "is this cron running?")
- The triggers list is server-rendered on page load; JS updates it in-place
  but does not fully client-render it (unlike pipeline steps)
- Changes to scheduler behavior or trigger types
- JS module reorganization of the existing pipeline editor modules

---

## Line budgets

| File | Budget |
|---|---|
| `mee6/web/api/triggers.py` | ≤ 80 lines |
| `modules/triggers/api-client.js` | ≤ 60 lines |
| `modules/triggers/validator.js` | ≤ 60 lines |
| `modules/triggers/event-handlers.js` | ≤ 80 lines |
| `modules/triggers/event-delegation.js` | ≤ 80 lines |
| `triggers-editor.js` | ≤ 80 lines |
| `triggers.html` (after) | ≤ 90 lines (from 120) |
