"""Tests for the school-monitor task flow."""

import json
from unittest.mock import AsyncMock, patch

import pytest

SAMPLE_EVENTS = [
    {
        "title": "Spring Break",
        "date": "2026-04-06",
        "time": "",
        "description": "School closed for spring break.",
        "type": "holiday",
    },
    {
        "title": "Parent-Teacher Meeting",
        "date": "2026-03-20",
        "time": "17:00",
        "description": "Annual parent-teacher conference.",
        "type": "meeting",
    },
]


@pytest.mark.asyncio
async def test_run_school_monitor_processes_each_event():
    with (
        patch(
            "mee6.tasks.school_events.SchoolMonitorAgent",
            autospec=True,
        ) as MockAgent,
        patch(
            "mee6.tasks.school_events.create_calendar_event",
            new_callable=AsyncMock,
        ) as mock_calendar,
        patch(
            "mee6.tasks.school_events.send_notification",
            new_callable=AsyncMock,
        ) as mock_whatsapp,
    ):
        instance = MockAgent.return_value
        instance.run = AsyncMock(return_value=json.dumps(SAMPLE_EVENTS))

        from mee6.tasks.school_events import run_school_monitor

        result = await run_school_monitor()

    assert result["events_processed"] == len(SAMPLE_EVENTS)
    assert result["errors"] == 0
    assert mock_calendar.call_count == len(SAMPLE_EVENTS)
    assert mock_whatsapp.call_count == len(SAMPLE_EVENTS)


@pytest.mark.asyncio
async def test_run_school_monitor_handles_invalid_json():
    with patch(
        "mee6.tasks.school_events.SchoolMonitorAgent",
        autospec=True,
    ) as MockAgent:
        instance = MockAgent.return_value
        instance.run = AsyncMock(return_value="not valid json")

        from mee6.tasks.school_events import run_school_monitor

        result = await run_school_monitor()

    assert result["events_processed"] == 0
    assert "Parse error" in result["summary"]


@pytest.mark.asyncio
async def test_run_school_monitor_handles_event_errors():
    with (
        patch(
            "mee6.tasks.school_events.SchoolMonitorAgent",
            autospec=True,
        ) as MockAgent,
        patch(
            "mee6.tasks.school_events.create_calendar_event",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Calendar API down"),
        ),
        patch(
            "mee6.tasks.school_events.send_notification",
            new_callable=AsyncMock,
        ),
    ):
        instance = MockAgent.return_value
        instance.run = AsyncMock(return_value=json.dumps(SAMPLE_EVENTS))

        from mee6.tasks.school_events import run_school_monitor

        result = await run_school_monitor()

    assert result["events_processed"] == 0
    assert result["errors"] == len(SAMPLE_EVENTS)
