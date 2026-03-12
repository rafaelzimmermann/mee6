"""Tests for the scheduler engine."""

from unittest.mock import AsyncMock, patch

import pytest

from mee6.scheduler.engine import RunRecord, SchedulerEngine, _dispatch_task

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_engine() -> SchedulerEngine:
    """Return a SchedulerEngine with a fully mocked APScheduler."""
    engine = SchedulerEngine()
    mock_apscheduler = AsyncMock()
    # add_schedule returns a job id string
    mock_apscheduler.add_schedule = AsyncMock(return_value="sched-id")
    engine._apscheduler = mock_apscheduler
    return engine


# ---------------------------------------------------------------------------
# Run-record tracking (pure Python, no APScheduler needed)
# ---------------------------------------------------------------------------

def test_record_run_start_and_end():
    engine = _make_engine()
    engine._record_run_start("school-monitor")
    assert "school-monitor" in engine._pending_run

    engine._record_run_end("school-monitor", "success", "2 events processed")

    assert "school-monitor" not in engine._pending_run
    assert len(engine._runs) == 1
    assert engine._runs[0].status == "success"
    assert engine._runs[0].summary == "2 events processed"


def test_record_run_end_without_start_uses_current_time():
    engine = _make_engine()
    engine._record_run_end("school-monitor", "error", "boom")
    assert engine._runs[0].agent_name == "school-monitor"
    assert engine._runs[0].status == "error"


def test_get_recent_runs_returns_newest_first():
    engine = _make_engine()
    for i in range(5):
        engine._runs.append(RunRecord(f"agent-{i}", f"2026-01-0{i + 1}", "success", "ok"))

    runs = engine.get_recent_runs()
    assert runs[0].agent_name == "agent-4"
    assert runs[-1].agent_name == "agent-0"


def test_get_recent_runs_respects_limit():
    engine = _make_engine()
    for i in range(10):
        engine._runs.append(RunRecord("a", f"ts-{i}", "success", "ok"))

    assert len(engine.get_recent_runs(limit=3)) == 3


def test_runs_capped_at_200():
    engine = _make_engine()
    for i in range(210):
        engine._record_run_end("agent", "success", str(i))

    assert len(engine._runs) == 200


# ---------------------------------------------------------------------------
# Job metadata (pure Python)
# ---------------------------------------------------------------------------

def test_list_jobs_empty():
    engine = _make_engine()
    assert engine.list_jobs() == []


def test_active_job_count():
    engine = _make_engine()
    from mee6.scheduler.engine import JobMeta

    engine._jobs["a"] = JobMeta(id="a", agent_name="foo", cron_expr="* * * * *", enabled=True)
    engine._jobs["b"] = JobMeta(id="b", agent_name="bar", cron_expr="* * * * *", enabled=False)
    engine._jobs["c"] = JobMeta(id="c", agent_name="baz", cron_expr="* * * * *", enabled=True)

    assert engine.active_job_count() == 2


# ---------------------------------------------------------------------------
# add_trigger / remove_trigger / toggle_trigger
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_add_trigger_registers_job():
    engine = _make_engine()

    job_id = await engine.add_trigger("school-monitor", "0 8 * * *", enabled=True)

    assert job_id in engine._jobs
    meta = engine._jobs[job_id]
    assert meta.agent_name == "school-monitor"
    assert meta.cron_expr == "0 8 * * *"
    assert meta.enabled is True
    engine._apscheduler.add_schedule.assert_awaited_once()


@pytest.mark.asyncio
async def test_add_trigger_paused_when_disabled():
    engine = _make_engine()
    await engine.add_trigger("school-monitor", "0 8 * * *", enabled=False)

    _, kwargs = engine._apscheduler.add_schedule.call_args
    assert kwargs["paused"] is True


@pytest.mark.asyncio
async def test_remove_trigger_deletes_job():
    engine = _make_engine()
    job_id = await engine.add_trigger("school-monitor", "0 8 * * *")

    await engine.remove_trigger(job_id)

    assert job_id not in engine._jobs
    engine._apscheduler.remove_schedule.assert_awaited_once_with(job_id)


@pytest.mark.asyncio
async def test_remove_trigger_unknown_id_is_noop():
    engine = _make_engine()
    # Should not raise even if the APScheduler call fails with a lookup error
    engine._apscheduler.remove_schedule = AsyncMock(side_effect=Exception("not found"))
    with pytest.raises(Exception):
        await engine.remove_trigger("nonexistent")


@pytest.mark.asyncio
async def test_toggle_trigger_disables_enabled_job():
    engine = _make_engine()
    job_id = await engine.add_trigger("school-monitor", "0 8 * * *", enabled=True)

    await engine.toggle_trigger(job_id)

    assert engine._jobs[job_id].enabled is False
    engine._apscheduler.pause_schedule.assert_awaited_once_with(job_id)


@pytest.mark.asyncio
async def test_toggle_trigger_enables_paused_job():
    engine = _make_engine()
    job_id = await engine.add_trigger("school-monitor", "0 8 * * *", enabled=False)

    await engine.toggle_trigger(job_id)

    assert engine._jobs[job_id].enabled is True
    engine._apscheduler.unpause_schedule.assert_awaited_once_with(job_id)


@pytest.mark.asyncio
async def test_toggle_trigger_unknown_id_is_noop():
    engine = _make_engine()
    await engine.toggle_trigger("nonexistent")  # should not raise


# ---------------------------------------------------------------------------
# _dispatch_task
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_dispatch_task_success():
    mock_task = AsyncMock(return_value={"summary": "3 events processed"})
    with (
        patch("mee6.scheduler.engine.scheduler") as mock_engine,
        patch.dict("mee6.scheduler.registry.TASK_REGISTRY", {"school-monitor": mock_task}),
    ):
        await _dispatch_task("school-monitor")

        mock_engine._record_run_start.assert_called_once_with("school-monitor")
        mock_engine._record_run_end.assert_called_once_with(
            "school-monitor", "success", "3 events processed"
        )


@pytest.mark.asyncio
async def test_dispatch_task_unregistered_agent():
    with (
        patch("mee6.scheduler.engine.scheduler") as mock_engine,
        patch.dict("mee6.scheduler.registry.TASK_REGISTRY", {}, clear=True),
    ):
        await _dispatch_task("unknown-agent")

        mock_engine._record_run_end.assert_called_once()
        args = mock_engine._record_run_end.call_args[0]
        assert args[1] == "error"
        assert "unknown-agent" in args[2]


@pytest.mark.asyncio
async def test_dispatch_task_records_error_on_exception():
    mock_task = AsyncMock(side_effect=RuntimeError("something went wrong"))
    with (
        patch("mee6.scheduler.engine.scheduler") as mock_engine,
        patch.dict("mee6.scheduler.registry.TASK_REGISTRY", {"school-monitor": mock_task}),
    ):
        await _dispatch_task("school-monitor")

        args = mock_engine._record_run_end.call_args[0]
        assert args[1] == "error"
        assert "something went wrong" in args[2]
