# Dead Code Cleanup — Round 2

## What was already cleaned up

The previous cleanup commits (e6b58a0, 24b7aa7) removed:

- All duplicate mutation routes from `routes/pipelines.py` (POST create, POST update, POST delete)
- The old HTML-rendering `POST /api/agents/{type}/fields` endpoint from both `routes/pipelines.py` and `api/agents.py`
- `class PipelineCreateRequest` and `class AgentFieldsRequest` local duplicates in routes
- `StepConfigValidator` and `PipelineNameValidator` from `validation.py`
- `templates/_agent_fields.html`
- `routes/pipelines.py.backup`
- 8 dead tests from `test_web_routes.py`
- Migrated `api-client.js` to `/api/v1/` with correct HTTP verbs
- Migrated `pipelines.html` delete from form POST to `fetch()` + DELETE

`routes/pipelines.py`, `api/agents.py`, `api-client.js`, and `templates/pipelines.html`
are now clean.

---

## What is still remaining

### 1. Dead imports in `mee6/web/api/agents.py` (trivial)

Two imports are only used by the `AgentFieldsRequest` class and the `render_agent_fields`
POST endpoint, both of which were removed:

```python
# line 6
from fastapi import APIRouter, HTTPException, Request, status
#                                              ^^^^^^^ no longer used

# line 7
from pydantic import BaseModel
# ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ no longer used (AgentFieldsRequest was removed)
```

**Fix:** Remove `Request` from the fastapi import and remove `from pydantic import BaseModel`.

**Risk:** None. Compile-time only — removing unused imports can't break runtime behaviour.

---

### 2. Stale module docstring in `mee6/web/routes/pipelines.py` (trivial)

Line 1:
```python
"""CRUD routes for pipelines and the agent-fields API endpoint."""
```

The agent-fields endpoint no longer lives here. Should read:
```python
"""Pipeline page routes (HTML)."""
```

**Risk:** None.

---

### 3. Stale trigger models — replace in triggers refactor Phase 1

These are NOT safe to just delete — they will be **replaced** with correct versions as
the first step of the triggers refactor. Do not touch them here.

| Item | Location | Issue |
|---|---|---|
| `TriggerResponse` | `models.py` lines 22–30 | Wrong shape: uses `job_id`/`name`/`cron_expression`/`next_run` — doesn't match `TriggerMeta` |
| `TriggerCreateRequest` | `models.py` lines 102–109 | Wrong shape: has `name` and `cron_expression`, missing `cron_expr`/`phone`/`group_jid` |
| `TriggerCreateRequestEnhanced` | `validation.py` lines 50–81 | Validates against `["cron", "whatsapp", "manual"]` — "manual" is wrong, real type is "wa_group" |
| `test_trigger_response_model` | `test_api.py` line 74 | Instantiates with `job_id=`, `name=`, `cron_expression=` — old field names |
| `test_trigger_create_request_enhanced_valid` | `test_api.py` line 356 | Uses `name=` field that no longer exists on the replacement model |
| `test_trigger_create_request_enhanced_invalid_type` | `test_api.py` line 367 | Tests that `"invalid"` is rejected — should test that `"manual"` is rejected |

All six items are addressed in `prompts/triggers-phase1.md` Steps 1, 2, and 6.

Also: `from datetime import datetime` in `models.py` is only used by `TriggerResponse`
(`next_run: Optional[datetime]`) and `RunRecordResponse` (see below). If both are removed
or replaced, this import goes away too.

---

### 4. Anticipatory models with no endpoint

These models were written speculatively for future JSON API work. No route currently
uses them. They carry no risk but add noise. Whether to remove them is a roadmap call —
remove if those features are not being built soon, keep if they are.

#### In `mee6/web/api/models.py`:

| Model | For future feature | Currently used anywhere? |
|---|---|---|
| `RunRecordResponse` (lines 34–42) | History/Dashboard JSON API | No |
| `RunningCountResponse` (lines 45–47) | Dashboard JSON API | No |
| `WhatsAppStatusResponse` (lines 51–54) | WhatsApp JSON API | No |
| `WhatsAppGroupResponse` (lines 57–60) | WhatsApp JSON API | No |
| `WhatsAppPhoneRequest` (lines 111–113) | WhatsApp JSON API | No |
| `CalendarResponse` (lines 63–67) | Google Calendar JSON API | No |
| `CalendarCreateRequest` (lines 116–120) | Google Calendar JSON API | No |
| `MemoryConfigResponse` (lines 70–75) | Memory config JSON API | No |
| `MemoryConfigRequest` (lines 123–128) | Memory config JSON API | No |

All nine are also re-exported in `mee6/web/api/__init__.py`.

#### Recommendation:

- **Remove:** `RunRecordResponse`, `RunningCountResponse` — the History page is already
  built as a template route with no JSON API planned in the near term
- **Keep:** The WhatsApp, Calendar, and Memory models — those integrations are active
  features and their JSON API endpoints are a likely next step; keeping the models avoids
  duplication when that work begins

If the "remove" items are deleted, also remove:
- Their exports from `__init__.py` (lines 10–11 in the imports block, lines 40–41 in `__all__`)
- The `from datetime import datetime` import in `models.py` becomes dead once
  `RunRecordResponse` and `TriggerResponse` are both gone

---

## Execution plan

### Step 1 — Dead imports in `api/agents.py` (5 min)

1. Remove `Request` from `from fastapi import ...`
2. Remove `from pydantic import BaseModel`

```bash
uv run pytest tests/test_api.py -v 2>&1 | tail -5
```
Expected: same pass count.

### Step 2 — Stale docstring in `routes/pipelines.py` (1 min)

Change line 1 to:
```python
"""Pipeline page routes (HTML)."""
```

### Step 3 — Remove `RunRecordResponse` and `RunningCountResponse` (optional)

Only do this if there is no near-term plan to build a JSON history/dashboard API.

1. Delete `RunRecordResponse` (lines 34–42 in `models.py`)
2. Delete `RunningCountResponse` (lines 45–47 in `models.py`)
3. Remove their imports and `__all__` entries from `__init__.py`
4. Check if `from datetime import datetime` is now unused — it will be if
   `TriggerResponse` was also replaced (Step 3 of triggers Phase 1 does this);
   if not yet, leave the import.

```bash
uv run pytest 2>&1 | tail -5
```
Expected: same pass count.

### Step 4 — Replace stale trigger models (do in triggers Phase 1)

Handled by `prompts/triggers-phase1.md`. Not repeated here.

---

## Verification checklist

After each step:
```bash
uv run pytest 2>&1 | tail -5   # Python: same count
npm test 2>&1 | tail -3         # JS: same count
```

After all steps:
```bash
grep -rn "Request\b" mee6/web/api/agents.py   # should return nothing
grep -n "BaseModel" mee6/web/api/agents.py     # should return nothing
grep -n "RunRecordResponse\|RunningCountResponse" mee6/web/api/models.py  # empty if removed
```
