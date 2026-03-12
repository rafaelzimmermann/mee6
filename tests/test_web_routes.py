"""Tests for the FastAPI web routes."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from mee6.scheduler.engine import JobMeta, RunRecord

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _mock_scheduler(jobs: list[JobMeta] | None = None, runs: list[RunRecord] | None = None):
    mock = MagicMock()
    mock.list_jobs.return_value = jobs or []
    mock.active_job_count.return_value = len([j for j in (jobs or []) if j.enabled])
    mock.get_recent_runs.return_value = runs or []
    mock.add_trigger = AsyncMock()
    mock.toggle_trigger = AsyncMock()
    mock.run_now = AsyncMock()
    mock.remove_trigger = AsyncMock()
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
    with (
        patch("mee6.web.routes.dashboard.scheduler", mock_scheduler),
        patch("mee6.web.routes.triggers.scheduler", mock_scheduler),
    ):
        from mee6.web.app import create_app

        app = create_app()
        app.router.lifespan_context = _noop_lifespan

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c, mock_scheduler


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_dashboard_returns_200(client):
    c, _ = client
    resp = await c.get("/")
    assert resp.status_code == 200
    assert b"Dashboard" in resp.content


@pytest.mark.asyncio
async def test_dashboard_shows_run_records(client):
    c, sched = client
    sched.get_recent_runs.return_value = [
        RunRecord("school-monitor", "2026-03-12T08:00:00", "success", "2 events"),
    ]
    resp = await c.get("/")
    assert b"school-monitor" in resp.content
    assert b"2 events" in resp.content


# ---------------------------------------------------------------------------
# Triggers list
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_triggers_list_returns_200(client):
    c, _ = client
    resp = await c.get("/triggers")
    assert resp.status_code == 200
    assert b"Triggers" in resp.content


@pytest.mark.asyncio
async def test_triggers_list_shows_jobs(client):
    c, sched = client
    sched.list_jobs.return_value = [
        JobMeta(id="abc", agent_name="school-monitor", cron_expr="0 8 * * *", enabled=True),
    ]
    resp = await c.get("/triggers")
    assert b"school-monitor" in resp.content
    assert b"0 8 * * *" in resp.content


# ---------------------------------------------------------------------------
# Create trigger
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_trigger_calls_add_and_redirects(client):
    c, sched = client
    resp = await c.post(
        "/triggers",
        data={"agent_name": "school-monitor", "cron_expr": "0 8 * * *"},
        follow_redirects=False,
    )
    assert resp.status_code == 303
    assert resp.headers["location"] == "/triggers"
    sched.add_trigger.assert_awaited_once_with(
        "school-monitor", "0 8 * * *", enabled=False
    )


@pytest.mark.asyncio
async def test_create_trigger_enabled_flag(client):
    c, sched = client
    await c.post(
        "/triggers",
        data={"agent_name": "school-monitor", "cron_expr": "0 8 * * *", "enabled": "true"},
        follow_redirects=False,
    )
    sched.add_trigger.assert_awaited_once_with(
        "school-monitor", "0 8 * * *", enabled=True
    )


# ---------------------------------------------------------------------------
# Toggle trigger
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_toggle_trigger_calls_engine_and_redirects(client):
    c, sched = client
    resp = await c.post("/triggers/job-123/toggle", follow_redirects=False)
    assert resp.status_code == 303
    sched.toggle_trigger.assert_awaited_once_with("job-123")


# ---------------------------------------------------------------------------
# Run now
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_now_calls_engine_and_redirects(client):
    c, sched = client
    resp = await c.post("/triggers/job-123/run-now", follow_redirects=False)
    assert resp.status_code == 303
    sched.run_now.assert_awaited_once_with("job-123")


# ---------------------------------------------------------------------------
# Delete trigger
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_trigger_calls_engine_and_redirects(client):
    c, sched = client
    resp = await c.post("/triggers/job-123/delete", follow_redirects=False)
    assert resp.status_code == 303
    sched.remove_trigger.assert_awaited_once_with("job-123")
