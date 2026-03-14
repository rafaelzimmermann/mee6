"""Tests for the FastAPI web routes."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from mee6.scheduler.engine import RunRecord, TriggerMeta

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _mock_scheduler(jobs: list[TriggerMeta] | None = None, runs: list[RunRecord] | None = None):
    mock = MagicMock()
    mock.list_jobs.return_value = jobs or []
    mock.active_job_count.return_value = len([j for j in (jobs or []) if j.enabled])
    mock.get_recent_runs.return_value = runs or []
    mock.add_trigger = AsyncMock()
    mock.toggle_trigger = AsyncMock()
    mock.run_now = AsyncMock()
    mock.remove_trigger = AsyncMock()
    return mock


def _mock_pipeline_store(pipelines=None):
    mock = MagicMock()
    mock.list = AsyncMock(return_value=pipelines or [])
    mock.get = AsyncMock(return_value=None)
    mock.upsert = AsyncMock()
    mock.delete = AsyncMock()
    return mock


@asynccontextmanager
async def _noop_lifespan(app: FastAPI):
    yield


@pytest.fixture()
def mock_scheduler():
    return _mock_scheduler()


@pytest.fixture()
async def client(mock_scheduler):
    """AsyncClient pointing at a test app with a no-op lifespan and mocked scheduler."""
    mock_store = _mock_pipeline_store()
    mock_step_repo = MagicMock()
    mock_step_repo.upsert_steps = AsyncMock()

    mock_session = MagicMock()
    mock_wa_repo = MagicMock()
    mock_wa_repo.list_all = AsyncMock(return_value=[])
    mock_session.return_value.__aenter__.return_value = mock_session

    with (
        patch("mee6.web.routes.history.scheduler", mock_scheduler),
        patch("mee6.web.routes.triggers.scheduler", mock_scheduler),
        patch("mee6.web.routes.triggers.pipeline_store", mock_store),
        patch("mee6.web.routes.pipelines.pipeline_store", mock_store),
        patch("mee6.web.routes.triggers.AsyncSessionLocal", mock_session),
        patch("mee6.web.routes.triggers.WhatsAppGroupRepository", return_value=mock_wa_repo),
    ):
        from mee6.web.app import create_app

        app = create_app()
        app.router.lifespan_context = _noop_lifespan

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c, mock_scheduler, mock_store, mock_step_repo


# ---------------------------------------------------------------------------
# History (dashboard)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dashboard_returns_200(client):
    c, _, _, _ = client
    resp = await c.get("/")
    assert resp.status_code == 200
    assert b"History" in resp.content


@pytest.mark.asyncio
async def test_dashboard_shows_run_records(client):
    c, sched, _, _ = client
    sched.get_recent_runs.return_value = [
        RunRecord("my-pipeline", "2026-03-12T08:00:00", "success", "2 events"),
    ]
    resp = await c.get("/")
    assert b"my-pipeline" in resp.content
    assert b"2 events" in resp.content


# ---------------------------------------------------------------------------
# Triggers list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_triggers_list_returns_200(client):
    c, _, _, _ = client
    resp = await c.get("/triggers")
    assert resp.status_code == 200
    assert b"Triggers" in resp.content


@pytest.mark.asyncio
async def test_triggers_list_shows_jobs(client):
    c, sched, _, _ = client
    sched.list_jobs.return_value = [
        TriggerMeta(
            id="abc",
            pipeline_id="pipe-1",
            pipeline_name="School Monitor",
            cron_expr="0 8 * * *",
            enabled=True,
        ),
    ]
    resp = await c.get("/triggers")
    assert b"School Monitor" in resp.content
    assert b"0 8 * * *" in resp.content


# ---------------------------------------------------------------------------
# Pipelines list
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Delete trigger (POST route removed — keeping only GET /triggers tests)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Pipelines list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pipelines_list_returns_200(client):
    c, _, _, _ = client
    resp = await c.get("/pipelines")
    assert resp.status_code == 200
    assert b"Pipelines" in resp.content


@pytest.mark.asyncio
async def test_pipelines_new_returns_200(client):
    c, _, _, _ = client
    resp = await c.get("/pipelines/new")
    assert resp.status_code == 200
    assert b"New Pipeline" in resp.content


# ---------------------------------------------------------------------------
# Create / update pipeline
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Pipeline editor page structure
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pipeline_editor_new_has_return_button(client):
    """GET /pipelines/new contains 'Return to Pipelines' link, not 'Cancel'."""
    c, _, _, _ = client
    resp = await c.get("/pipelines/new")
    assert resp.status_code == 200
    assert b"Return to Pipelines" in resp.content
    assert b"Cancel" not in resp.content


@pytest.mark.asyncio
async def test_pipeline_editor_new_has_batch_schema_url(client):
    """GET /pipelines/new references the apiClient for client-side rendering."""
    c, _, _, _ = client
    resp = await c.get("/pipelines/new")
    assert resp.status_code == 200
    # The new module-based editor imports apiClient for schema fetching
    assert b"apiClient" in resp.content


@pytest.mark.asyncio
async def test_pipeline_editor_edit_renders_pipeline_json(client):
    """GET /pipelines/{id} embeds pipeline JSON for initialisation."""
    from mee6.pipelines.models import Pipeline, PipelineStep

    c, _, mock_store, _ = client
    mock_store.get.return_value = Pipeline(
        id="pipe-1",
        name="My Pipeline",
        steps=[PipelineStep(agent_type="llm_agent", config={"prompt": "hello"})],
    )
    resp = await c.get("/pipelines/pipe-1")
    assert resp.status_code == 200
    assert b"My Pipeline" in resp.content
    assert b"llm_agent" in resp.content
