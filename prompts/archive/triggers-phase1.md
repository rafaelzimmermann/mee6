# Triggers Refactor — Phase 1: JSON API

## Goal

Add a JSON REST API for trigger mutations so the frontend can call them with
`fetch()` instead of submitting HTML forms. This is the Python-only phase;
no JS or template changes happen here.

When this phase is done:
- `POST /api/v1/triggers` creates a trigger and returns JSON
- `POST /api/v1/triggers/{id}/toggle` toggles enabled state and returns JSON
- `POST /api/v1/triggers/{id}/run-now` fires the pipeline immediately and returns JSON
- `DELETE /api/v1/triggers/{id}` removes a trigger
- The existing `GET /triggers` and all existing form `POST /triggers/*` routes are
  **untouched** — the page still works as before
- All new endpoints are covered by tests in `tests/test_api_triggers.py`

---

## Before starting

```bash
uv run pytest 2>&1 | tail -5
```

Expected: 127 passed, 6 failed (pre-existing). Stop if more than 6 fail.

---

## Existing code to be aware of

### Stale models — fix, do not add to

`mee6/web/api/models.py` already contains `TriggerResponse` (lines 22–30) and
`TriggerCreateRequest` (lines 102–109) but they were written speculatively and
do not match the real `TriggerMeta` dataclass in `scheduler/engine.py`.

`mee6/web/api/validation.py` already contains `TriggerCreateRequestEnhanced`
(lines 80–111) but it validates `trigger_type` against `["cron", "whatsapp", "manual"]`
— "manual" is wrong (the real third type is "wa_group").

`tests/test_api.py` has two tests using the stale models (lines 75–88 and 377–395).

**Do not work around these — fix them in place.**

### Relevant existing code — read before writing anything

| File | What to read |
|---|---|
| `mee6/scheduler/engine.py` | `TriggerType` enum (line 24), `TriggerMeta` dataclass (line 30), `add_trigger()` signature (line 120), `toggle_trigger()` (line 192), `run_now()` (line 207), `remove_trigger()` (line 180), `list_jobs()` (line 257) |
| `mee6/web/api/pipelines.py` | The pattern to follow exactly |
| `mee6/web/app.py` | Where to register the new router (line 142–143) |
| `mee6/web/api/__init__.py` | What to export |
| `tests/test_api.py` | Test fixture pattern (`api_client`, `_noop_lifespan`) to replicate |

---

## Step 1 — Fix `mee6/web/api/models.py`

Replace the existing `TriggerResponse` (lines 22–30) and `TriggerCreateRequest`
(lines 102–109) with the versions below. The field names and types must match
`TriggerMeta` exactly so the router can build responses directly from scheduler state.

**Replace `TriggerResponse`:**
```python
class TriggerResponse(BaseModel):
    """Response model for a trigger, built from TriggerMeta."""
    id: str = Field(..., description="Unique trigger job ID")
    pipeline_id: str = Field(..., description="Associated pipeline ID")
    pipeline_name: str = Field(..., description="Pipeline display name")
    trigger_type: str = Field(..., description="cron | whatsapp | wa_group")
    cron_expr: Optional[str] = Field(None, description="Cron expression (cron type only)")
    config: dict = Field(default_factory=dict, description="Type-specific config")
    enabled: bool = Field(..., description="Whether the trigger is active")
```

**Replace `TriggerCreateRequest`:**
```python
class TriggerCreateRequest(BaseModel):
    """Request model for trigger creation."""
    pipeline_id: str = Field(..., description="Pipeline to trigger")
    trigger_type: str = Field(..., description="cron | whatsapp | wa_group")
    cron_expr: Optional[str] = Field(None, description="Required for cron type")
    phone: Optional[str] = Field(None, description="Required for whatsapp type")
    group_jid: Optional[str] = Field(None, description="Required for wa_group type")
    enabled: bool = Field(default=True, description="Start enabled")
```

Remove the `name` field — triggers have no name, they are identified by pipeline and type.

---

## Step 2 — Fix `mee6/web/api/validation.py`

Replace `TriggerCreateRequestEnhanced` (lines 80–111) with a version that:
- Has no `name` field (triggers have no name)
- Validates `trigger_type` against `["cron", "whatsapp", "wa_group"]` (not "manual")
- Validates type-specific required fields cross-field

```python
class TriggerCreateRequestEnhanced(BaseModel):
    """Request model for trigger creation with cross-field validation."""

    pipeline_id: str
    trigger_type: str
    cron_expr: Optional[str] = None
    phone: Optional[str] = None
    group_jid: Optional[str] = None
    enabled: bool = True

    @field_validator("pipeline_id")
    @classmethod
    def pipeline_id_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Pipeline ID is required")
        return v.strip()

    @field_validator("trigger_type")
    @classmethod
    def trigger_type_valid(cls, v: str) -> str:
        valid = ["cron", "whatsapp", "wa_group"]
        if v not in valid:
            raise ValueError(f"trigger_type must be one of: {', '.join(valid)}")
        return v

    @model_validator(mode="after")
    def type_specific_fields_present(self) -> "TriggerCreateRequestEnhanced":
        if self.trigger_type == "cron" and not (self.cron_expr or "").strip():
            raise ValueError("cron_expr is required for cron triggers")
        if self.trigger_type == "whatsapp" and not (self.phone or "").strip():
            raise ValueError("phone is required for whatsapp triggers")
        if self.trigger_type == "wa_group" and not (self.group_jid or "").strip():
            raise ValueError("group_jid is required for wa_group triggers")
        return self
```

Add `from pydantic import model_validator` to the imports at the top of the file.

---

## Step 3 — Create `mee6/web/api/triggers.py`

```python
"""REST API routes for triggers.

All endpoints return JSON responses for frontend consumption.
"""

from fastapi import APIRouter, HTTPException, status

from mee6.scheduler.engine import TriggerType, scheduler
from mee6.web.api.models import TriggerCreateRequest, TriggerResponse

router = APIRouter()


def _meta_to_response(meta) -> TriggerResponse:
    return TriggerResponse(
        id=meta.id,
        pipeline_id=meta.pipeline_id,
        pipeline_name=meta.pipeline_name,
        trigger_type=meta.trigger_type.value,
        cron_expr=meta.cron_expr,
        config=meta.config,
        enabled=meta.enabled,
    )


@router.post("", response_model=TriggerResponse, status_code=status.HTTP_201_CREATED)
async def create_trigger(data: TriggerCreateRequest):
    """Create a new trigger."""
    if data.trigger_type == TriggerType.WHATSAPP:
        config: dict = {"phone": data.phone or ""}
    elif data.trigger_type == TriggerType.WA_GROUP:
        config = {"group_jid": data.group_jid or ""}
    else:
        config = {}

    job_id = await scheduler.add_trigger(
        data.pipeline_id,
        data.cron_expr or None,
        trigger_type=TriggerType(data.trigger_type),
        config=config,
        enabled=data.enabled,
    )
    meta = scheduler._jobs[job_id]
    return _meta_to_response(meta)


@router.post("/{trigger_id}/toggle")
async def toggle_trigger(trigger_id: str):
    """Toggle a trigger's enabled state."""
    if trigger_id not in scheduler._jobs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
    await scheduler.toggle_trigger(trigger_id)
    meta = scheduler._jobs[trigger_id]
    return {"id": trigger_id, "enabled": meta.enabled}


@router.post("/{trigger_id}/run-now")
async def run_now(trigger_id: str):
    """Fire a trigger's pipeline immediately, regardless of schedule."""
    if trigger_id not in scheduler._jobs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
    await scheduler.run_now(trigger_id)
    return {"ok": True}


@router.delete("/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trigger(trigger_id: str):
    """Delete a trigger."""
    if trigger_id not in scheduler._jobs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
    await scheduler.remove_trigger(trigger_id)
```

---

## Step 4 — Register the router in `mee6/web/app.py`

Add to the imports at line 14:
```python
from mee6.web.api import agents, pipelines as api_pipelines, triggers as api_triggers
```

Add after the existing API router registrations (after line 143):
```python
app.include_router(api_triggers.router, prefix="/api/v1/triggers")
```

---

## Step 5 — Update `mee6/web/api/__init__.py`

Add `triggers` to the router imports:
```python
from mee6.web.api import agents, pipelines, triggers
```

Add `TriggerCreateRequest` and the fixed `TriggerResponse` to `__all__`
(they're already listed; just verify the names match the updated models).

Remove `TriggerCreateRequestEnhanced` from `__all__` only if it is no longer
directly imported elsewhere. Check:
```bash
grep -rn "TriggerCreateRequestEnhanced" mee6/ tests/
```
If it appears only in `validation.py` and `__init__.py`, it can stay in `__all__`
with the updated implementation. Do not remove it from the file — it is used by the
validation tests.

---

## Step 6 — Fix stale tests in `tests/test_api.py`

The two stale tests that use the old model shape must be updated to match the
new fields.

**Replace `test_trigger_response_model` (lines 75–88):**
```python
def test_trigger_response_model():
    """TriggerResponse model can be instantiated with TriggerMeta fields."""
    model = models.TriggerResponse(
        id="job-123",
        pipeline_id="pipe-1",
        pipeline_name="My Pipeline",
        trigger_type="cron",
        cron_expr="0 8 * * *",
        config={},
        enabled=True,
    )
    assert model.id == "job-123"
    assert model.enabled is True
    assert model.pipeline_name == "My Pipeline"
```

**Replace `test_trigger_create_request_enhanced_valid` (lines 377–385):**
```python
def test_trigger_create_request_enhanced_valid():
    """TriggerCreateRequestEnhanced accepts a valid cron trigger."""
    v = validation.TriggerCreateRequestEnhanced(
        pipeline_id="pipe-1",
        trigger_type="cron",
        cron_expr="0 8 * * *",
    )
    assert v.trigger_type == "cron"
    assert v.cron_expr == "0 8 * * *"
```

**Replace `test_trigger_create_request_enhanced_invalid_type` (lines 388–395):**
```python
def test_trigger_create_request_enhanced_invalid_type():
    """TriggerCreateRequestEnhanced rejects unknown trigger types."""
    with pytest.raises(ValueError):
        validation.TriggerCreateRequestEnhanced(
            pipeline_id="pipe-1",
            trigger_type="manual",   # "manual" is not a valid type
            cron_expr="0 8 * * *",
        )
```

Run after fixing:
```bash
uv run pytest tests/test_api.py -v 2>&1 | tail -20
```
All tests in `test_api.py` must pass before moving to Step 7.

---

## Step 7 — Write `tests/test_api_triggers.py`

Follow the fixture pattern from `tests/test_api.py` exactly: create a minimal
FastAPI app, include only the triggers router, mock the scheduler singleton,
use `httpx.AsyncClient` with `ASGITransport`.

```python
"""Tests for /api/v1/triggers endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from mee6.scheduler.engine import TriggerMeta, TriggerType


@asynccontextmanager
async def _noop_lifespan(app):
    yield


def _make_meta(job_id="job-1", trigger_type=TriggerType.CRON, enabled=True, **kwargs):
    return TriggerMeta(
        id=job_id,
        pipeline_id="pipe-1",
        pipeline_name="Test Pipeline",
        enabled=enabled,
        trigger_type=trigger_type,
        cron_expr=kwargs.get("cron_expr", "0 8 * * *"),
        config=kwargs.get("config", {}),
    )


@pytest.fixture()
async def triggers_client():
    mock_scheduler = MagicMock()
    mock_scheduler.add_trigger = AsyncMock(return_value="job-1")
    mock_scheduler.toggle_trigger = AsyncMock()
    mock_scheduler.run_now = AsyncMock()
    mock_scheduler.remove_trigger = AsyncMock()
    mock_scheduler._jobs = {}

    with patch("mee6.web.api.triggers.scheduler", mock_scheduler):
        from mee6.web.api import triggers

        app = FastAPI()
        app.router.lifespan_context = _noop_lifespan
        app.include_router(triggers.router, prefix="/api/v1/triggers")

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            yield client, mock_scheduler
```

### Tests to write

Write each test as a separate `@pytest.mark.asyncio` async function.

**Create — cron trigger:**
```python
@pytest.mark.asyncio
async def test_create_cron_trigger(triggers_client):
    client, mock_scheduler = triggers_client
    meta = _make_meta(cron_expr="0 8 * * *")
    mock_scheduler._jobs["job-1"] = meta

    resp = await client.post("/api/v1/triggers", json={
        "pipeline_id": "pipe-1",
        "trigger_type": "cron",
        "cron_expr": "0 8 * * *",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == "job-1"
    assert data["trigger_type"] == "cron"
    assert data["cron_expr"] == "0 8 * * *"
    assert data["pipeline_name"] == "Test Pipeline"
    mock_scheduler.add_trigger.assert_awaited_once()
```

**Create — whatsapp trigger:**
```python
@pytest.mark.asyncio
async def test_create_whatsapp_trigger(triggers_client):
    client, mock_scheduler = triggers_client
    meta = _make_meta(trigger_type=TriggerType.WHATSAPP, cron_expr=None,
                      config={"phone": "+34612345678"})
    mock_scheduler._jobs["job-1"] = meta

    resp = await client.post("/api/v1/triggers", json={
        "pipeline_id": "pipe-1",
        "trigger_type": "whatsapp",
        "phone": "+34612345678",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["trigger_type"] == "whatsapp"
    assert data["config"]["phone"] == "+34612345678"
```

**Create — wa_group trigger:**
```python
@pytest.mark.asyncio
async def test_create_wa_group_trigger(triggers_client):
    client, mock_scheduler = triggers_client
    meta = _make_meta(trigger_type=TriggerType.WA_GROUP, cron_expr=None,
                      config={"group_jid": "120363xxx@g.us"})
    mock_scheduler._jobs["job-1"] = meta

    resp = await client.post("/api/v1/triggers", json={
        "pipeline_id": "pipe-1",
        "trigger_type": "wa_group",
        "group_jid": "120363xxx@g.us",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["config"]["group_jid"] == "120363xxx@g.us"
```

**Create — validation rejects cron without cron_expr:**
```python
@pytest.mark.asyncio
async def test_create_cron_trigger_missing_cron_expr(triggers_client):
    client, mock_scheduler = triggers_client

    resp = await client.post("/api/v1/triggers", json={
        "pipeline_id": "pipe-1",
        "trigger_type": "cron",
        # cron_expr missing
    })
    assert resp.status_code == 422
    mock_scheduler.add_trigger.assert_not_awaited()
```

**Create — validation rejects whatsapp without phone:**
```python
@pytest.mark.asyncio
async def test_create_whatsapp_trigger_missing_phone(triggers_client):
    client, mock_scheduler = triggers_client

    resp = await client.post("/api/v1/triggers", json={
        "pipeline_id": "pipe-1",
        "trigger_type": "whatsapp",
        # phone missing
    })
    assert resp.status_code == 422
    mock_scheduler.add_trigger.assert_not_awaited()
```

**Create — validation rejects unknown trigger type:**
```python
@pytest.mark.asyncio
async def test_create_trigger_invalid_type(triggers_client):
    client, mock_scheduler = triggers_client

    resp = await client.post("/api/v1/triggers", json={
        "pipeline_id": "pipe-1",
        "trigger_type": "manual",
        "cron_expr": "0 8 * * *",
    })
    assert resp.status_code == 422
```

**Create — validation rejects empty pipeline_id:**
```python
@pytest.mark.asyncio
async def test_create_trigger_empty_pipeline_id(triggers_client):
    client, mock_scheduler = triggers_client

    resp = await client.post("/api/v1/triggers", json={
        "pipeline_id": "",
        "trigger_type": "cron",
        "cron_expr": "0 8 * * *",
    })
    assert resp.status_code == 422
```

**Toggle — returns new enabled state:**
```python
@pytest.mark.asyncio
async def test_toggle_trigger(triggers_client):
    client, mock_scheduler = triggers_client
    meta = _make_meta(enabled=True)
    mock_scheduler._jobs["job-1"] = meta

    # Simulate toggle flipping the state
    async def _toggle(job_id):
        mock_scheduler._jobs[job_id].enabled = not mock_scheduler._jobs[job_id].enabled
    mock_scheduler.toggle_trigger.side_effect = _toggle

    resp = await client.post("/api/v1/triggers/job-1/toggle")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "job-1"
    assert data["enabled"] is False
```

**Toggle — 404 for unknown id:**
```python
@pytest.mark.asyncio
async def test_toggle_trigger_not_found(triggers_client):
    client, mock_scheduler = triggers_client
    # _jobs is empty

    resp = await client.post("/api/v1/triggers/unknown-id/toggle")
    assert resp.status_code == 404
```

**Run now — success:**
```python
@pytest.mark.asyncio
async def test_run_now(triggers_client):
    client, mock_scheduler = triggers_client
    mock_scheduler._jobs["job-1"] = _make_meta()

    resp = await client.post("/api/v1/triggers/job-1/run-now")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    mock_scheduler.run_now.assert_awaited_once_with("job-1")
```

**Run now — 404 for unknown id:**
```python
@pytest.mark.asyncio
async def test_run_now_not_found(triggers_client):
    client, mock_scheduler = triggers_client

    resp = await client.post("/api/v1/triggers/unknown-id/run-now")
    assert resp.status_code == 404
```

**Delete — 204 on success:**
```python
@pytest.mark.asyncio
async def test_delete_trigger(triggers_client):
    client, mock_scheduler = triggers_client
    mock_scheduler._jobs["job-1"] = _make_meta()

    resp = await client.delete("/api/v1/triggers/job-1")
    assert resp.status_code == 204
    mock_scheduler.remove_trigger.assert_awaited_once_with("job-1")
```

**Delete — 404 for unknown id:**
```python
@pytest.mark.asyncio
async def test_delete_trigger_not_found(triggers_client):
    client, mock_scheduler = triggers_client

    resp = await client.delete("/api/v1/triggers/unknown-id")
    assert resp.status_code == 404
```

---

## Final verification

```bash
uv run pytest tests/test_api.py tests/test_api_triggers.py -v 2>&1
```

Expected: all tests in both files pass.

```bash
uv run pytest 2>&1 | tail -5
```

Expected: same total as before (127 passed, 6 failed) plus the new tests.
The pre-existing 6 failures must not change.

```bash
# Confirm the router is reachable (requires running server):
# curl -s -X POST http://localhost:8000/api/v1/triggers \
#   -H "Content-Type: application/json" \
#   -d '{"pipeline_id":"x","trigger_type":"cron","cron_expr":"0 8 * * *"}' | python -m json.tool
```

---

## What NOT to do

- Do not touch `mee6/web/routes/triggers.py` — the existing form routes stay
- Do not touch `triggers.html` — that is Phase 3
- Do not create any JS files — that is Phase 2
- Do not delete `TriggerCreateRequestEnhanced` from `validation.py` — it is
  tested and will be used by Phase 2 JS validation as the server-side counterpart
- Do not rename `TriggerType` enum values — they are used throughout the scheduler
