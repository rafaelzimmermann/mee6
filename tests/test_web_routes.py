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
    with (
        patch("mee6.web.routes.history.scheduler", mock_scheduler),
        patch("mee6.web.routes.triggers.scheduler", mock_scheduler),
        patch("mee6.web.routes.triggers.pipeline_store", mock_store),
        patch("mee6.web.routes.pipelines.pipeline_store", mock_store),
    ):
        from mee6.web.app import create_app

        app = create_app()
        app.router.lifespan_context = _noop_lifespan

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c, mock_scheduler, mock_store


# ---------------------------------------------------------------------------
# History (dashboard)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dashboard_returns_200(client):
    c, _, _ = client
    resp = await c.get("/")
    assert resp.status_code == 200
    assert b"History" in resp.content


@pytest.mark.asyncio
async def test_dashboard_shows_run_records(client):
    c, sched, _ = client
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
    c, _, _ = client
    resp = await c.get("/triggers")
    assert resp.status_code == 200
    assert b"Triggers" in resp.content


@pytest.mark.asyncio
async def test_triggers_list_shows_jobs(client):
    c, sched, _ = client
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
# Create trigger
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_trigger_calls_add_and_redirects(client):
    c, sched, _ = client
    resp = await c.post(
        "/triggers",
        data={
            "pipeline_id": "pipe-1",
            "pipeline_name": "My Pipeline",
            "cron_expr": "0 8 * * *",
        },
        follow_redirects=False,
    )
    assert resp.status_code == 303
    assert resp.headers["location"] == "/triggers"
    sched.add_trigger.assert_awaited_once_with(
        "pipe-1", "My Pipeline", "0 8 * * *", enabled=False
    )


@pytest.mark.asyncio
async def test_create_trigger_enabled_flag(client):
    c, sched, _ = client
    await c.post(
        "/triggers",
        data={
            "pipeline_id": "pipe-1",
            "pipeline_name": "My Pipeline",
            "cron_expr": "0 8 * * *",
            "enabled": "true",
        },
        follow_redirects=False,
    )
    sched.add_trigger.assert_awaited_once_with(
        "pipe-1", "My Pipeline", "0 8 * * *", enabled=True
    )


# ---------------------------------------------------------------------------
# Toggle trigger
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_toggle_trigger_calls_engine_and_redirects(client):
    c, sched, _ = client
    resp = await c.post("/triggers/job-123/toggle", follow_redirects=False)
    assert resp.status_code == 303
    sched.toggle_trigger.assert_awaited_once_with("job-123")


# ---------------------------------------------------------------------------
# Run now
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_now_calls_engine_and_redirects(client):
    c, sched, _ = client
    resp = await c.post("/triggers/job-123/run-now", follow_redirects=False)
    assert resp.status_code == 303
    sched.run_now.assert_awaited_once_with("job-123")


# ---------------------------------------------------------------------------
# Delete trigger
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_trigger_calls_engine_and_redirects(client):
    c, sched, _ = client
    resp = await c.post("/triggers/job-123/delete", follow_redirects=False)
    assert resp.status_code == 303
    sched.remove_trigger.assert_awaited_once_with("job-123")


# ---------------------------------------------------------------------------
# Pipelines list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pipelines_list_returns_200(client):
    c, _, _ = client
    resp = await c.get("/pipelines")
    assert resp.status_code == 200
    assert b"Pipelines" in resp.content


@pytest.mark.asyncio
async def test_pipelines_new_returns_200(client):
    c, _, _ = client
    resp = await c.get("/pipelines/new")
    assert resp.status_code == 200
    assert b"New Pipeline" in resp.content


@pytest.mark.asyncio
async def test_agent_fields_endpoint_returns_html(client):
    c, _, _ = client
    resp = await c.get("/api/agents/browser_agent/fields?step_index=0")
    assert resp.status_code == 200
    assert b"task" in resp.content.lower()


@pytest.mark.asyncio
async def test_agent_fields_unknown_agent_returns_empty(client):
    c, _, _ = client
    resp = await c.get("/api/agents/nonexistent/fields")
    assert resp.status_code == 200
    assert resp.content == b""
