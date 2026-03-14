"""Tests for triggers REST API."""

from unittest.mock import AsyncMock, MagicMock, patch
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from mee6.scheduler.engine import TriggerMeta, TriggerType


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@asynccontextmanager
async def _noop_lifespan(app: FastAPI):
    yield


@pytest.fixture()
async def triggers_client():
    """AsyncClient pointing at a test app with mocked scheduler."""
    mock_scheduler = MagicMock()

    with patch("mee6.web.api.triggers.scheduler", mock_scheduler):
        mock_scheduler.add_trigger = AsyncMock(return_value="test-job-id")
        mock_scheduler.toggle_trigger = AsyncMock()
        mock_scheduler.run_now = AsyncMock()
        mock_scheduler.remove_trigger = AsyncMock()

        from mee6.web.api import triggers

        app = FastAPI()
        app.router.lifespan_context = _noop_lifespan
        app.include_router(triggers.router, prefix="/api/v1/triggers")

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client, mock_scheduler


# ---------------------------------------------------------------------------
# CREATE — one test per trigger type
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_cron_trigger(triggers_client):
    """POST / creates a cron trigger and returns 201."""
    client, mock_scheduler = triggers_client

    mock_scheduler._jobs = {
        "test-job-id": TriggerMeta(
            id="test-job-id",
            pipeline_id="pipe-1",
            pipeline_name="Test Pipeline",
            trigger_type=TriggerType.CRON,
            cron_expr="0 9 * * *",
            config={},
            enabled=True,
        )
    }

    payload = {
        "pipeline_id": "pipe-1",
        "trigger_type": "cron",
        "cron_expr": "0 9 * * *",
        "enabled": True,
    }

    resp = await client.post("/api/v1/triggers/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == "test-job-id"
    assert data["pipeline_id"] == "pipe-1"
    assert data["pipeline_name"] == "Test Pipeline"
    assert data["trigger_type"] == "cron"
    assert data["cron_expr"] == "0 9 * * *"
    assert data["enabled"] is True

    mock_scheduler.add_trigger.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_whatsapp_trigger(triggers_client):
    """POST / creates a whatsapp trigger with phone config."""
    client, mock_scheduler = triggers_client

    mock_scheduler._jobs = {
        "test-job-id": TriggerMeta(
            id="test-job-id",
            pipeline_id="pipe-1",
            pipeline_name="Test Pipeline",
            trigger_type=TriggerType.WHATSAPP,
            cron_expr=None,
            config={"phone": "+34600000000"},
            enabled=True,
        )
    }

    payload = {
        "pipeline_id": "pipe-1",
        "trigger_type": "whatsapp",
        "phone": "+34600000000",
        "enabled": True,
    }

    resp = await client.post("/api/v1/triggers/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["config"] == {"phone": "+34600000000"}

    mock_scheduler.add_trigger.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_wa_group_trigger(triggers_client):
    """POST / creates a wa_group trigger with group_jid config."""
    client, mock_scheduler = triggers_client

    mock_scheduler._jobs = {
        "test-job-id": TriggerMeta(
            id="test-job-id",
            pipeline_id="pipe-1",
            pipeline_name="Test Pipeline",
            trigger_type=TriggerType.WA_GROUP,
            cron_expr=None,
            config={"group_jid": "120363123456789@g.us"},
            enabled=True,
        )
    }

    payload = {
        "pipeline_id": "pipe-1",
        "trigger_type": "wa_group",
        "group_jid": "120363123456789@g.us",
        "enabled": True,
    }

    resp = await client.post("/api/v1/triggers/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["config"] == {"group_jid": "120363123456789@g.us"}

    mock_scheduler.add_trigger.assert_awaited_once()


# ---------------------------------------------------------------------------
# CREATE — validation rejects invalid input
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_trigger_missing_cron_expr(triggers_client):
    """POST / returns 422 when cron trigger is missing cron_expr."""
    client, _ = triggers_client

    payload = {
        "pipeline_id": "pipe-1",
        "trigger_type": "cron",
    }

    resp = await client.post("/api/v1/triggers/", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_trigger_missing_phone(triggers_client):
    """POST / returns 422 when whatsapp trigger is missing phone."""
    client, _ = triggers_client

    payload = {
        "pipeline_id": "pipe-1",
        "trigger_type": "whatsapp",
    }

    resp = await client.post("/api/v1/triggers/", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_trigger_unknown_type(triggers_client):
    """POST / returns 422 when trigger_type is invalid."""
    client, _ = triggers_client

    payload = {
        "pipeline_id": "pipe-1",
        "trigger_type": "manual",
    }

    resp = await client.post("/api/v1/triggers/", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_trigger_empty_pipeline_id(triggers_client):
    """POST / returns 422 when pipeline_id is empty."""
    client, _ = triggers_client

    payload = {
        "pipeline_id": "",
        "trigger_type": "cron",
        "cron_expr": "0 9 * * *",
    }

    resp = await client.post("/api/v1/triggers/", json=payload)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# TOGGLE
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_toggle_trigger_returns_new_enabled_state(triggers_client):
    """POST /{id}/toggle returns the new enabled state."""
    client, mock_scheduler = triggers_client

    mock_scheduler._jobs = {
        "test-id": TriggerMeta(
            id="test-id",
            pipeline_id="pipe-1",
            pipeline_name="Test Pipeline",
            trigger_type=TriggerType.CRON,
            cron_expr="0 9 * * *",
            config={},
            enabled=False,
        )
    }

    resp = await client.post("/api/v1/triggers/test-id/toggle")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "test-id"
    assert "enabled" in data

    mock_scheduler.toggle_trigger.assert_awaited_once_with("test-id")


@pytest.mark.asyncio
async def test_toggle_trigger_not_found(triggers_client):
    """POST /{id}/toggle returns 404 when trigger not found."""
    client, mock_scheduler = triggers_client

    mock_scheduler._jobs = {}

    resp = await client.post("/api/v1/triggers/nonexistent-id/toggle")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# RUN NOW
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_now_returns_ok(triggers_client):
    """POST /{id}/run-now fires the trigger immediately."""
    client, mock_scheduler = triggers_client

    mock_scheduler._jobs = {
        "test-id": TriggerMeta(
            id="test-id",
            pipeline_id="pipe-1",
            pipeline_name="Test Pipeline",
            trigger_type=TriggerType.CRON,
            cron_expr="0 9 * * *",
            config={},
            enabled=True,
        )
    }

    resp = await client.post("/api/v1/triggers/test-id/run-now")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True

    mock_scheduler.run_now.assert_awaited_once_with("test-id")


@pytest.mark.asyncio
async def test_run_now_not_found(triggers_client):
    """POST /{id}/run-now returns 404 when trigger not found."""
    client, mock_scheduler = triggers_client

    mock_scheduler._jobs = {}

    resp = await client.post("/api/v1/triggers/nonexistent-id/run-now")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_trigger_returns_204(triggers_client):
    """DELETE /{id} deletes the trigger and returns 204."""
    client, mock_scheduler = triggers_client

    mock_scheduler._jobs = {
        "test-id": TriggerMeta(
            id="test-id",
            pipeline_id="pipe-1",
            pipeline_name="Test Pipeline",
            trigger_type=TriggerType.CRON,
            cron_expr="0 9 * * *",
            config={},
            enabled=True,
        )
    }

    resp = await client.delete("/api/v1/triggers/test-id")
    assert resp.status_code == 204
    assert resp.content == b""

    mock_scheduler.remove_trigger.assert_awaited_once_with("test-id")


@pytest.mark.asyncio
async def test_delete_trigger_not_found(triggers_client):
    """DELETE /{id} returns 404 when trigger not found."""
    client, mock_scheduler = triggers_client

    mock_scheduler._jobs = {}

    resp = await client.delete("/api/v1/triggers/nonexistent-id")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()
