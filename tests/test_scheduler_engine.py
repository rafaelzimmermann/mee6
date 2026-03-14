"""Tests for the scheduler engine."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mee6.scheduler.engine import RunRecord, SchedulerEngine, _dispatch_pipeline

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_engine() -> SchedulerEngine:
    """Return a SchedulerEngine with a fully mocked APScheduler and no-op persistence."""
    engine = SchedulerEngine()
    mock_apscheduler = AsyncMock()
    mock_apscheduler.add_schedule = AsyncMock(return_value="sched-id")
    engine._apscheduler = mock_apscheduler
    return engine


# ---------------------------------------------------------------------------
# Run-record tracking (pure Python, no APScheduler needed)
# ---------------------------------------------------------------------------


def test_record_run_start_and_end():
    engine = _make_engine()
    engine._record_run_start("my-pipeline")
    assert "my-pipeline" in engine._pending_run

    engine._record_run_end("my-pipeline", "My Pipeline", "success", "2 events processed")

    assert "my-pipeline" not in engine._pending_run
    assert len(engine._runs) == 1
    assert engine._runs[0].status == "success"
    assert engine._runs[0].summary == "2 events processed"
    assert engine._runs[0].pipeline_name == "My Pipeline"


def test_record_run_end_without_start_uses_current_time():
    engine = _make_engine()
    engine._record_run_end("my-pipeline", "my-pipeline", "error", "boom")
    assert engine._runs[0].pipeline_name == "my-pipeline"
    assert engine._runs[0].status == "error"


def test_get_recent_runs_returns_newest_first():
    engine = _make_engine()
    for i in range(5):
        engine._runs.append(RunRecord(f"pipeline-{i}", f"2026-01-0{i + 1}", "success", "ok"))

    runs = engine.get_recent_runs()
    assert runs[0].pipeline_name == "pipeline-4"
    assert runs[-1].pipeline_name == "pipeline-0"


def test_get_recent_runs_respects_limit():
    engine = _make_engine()
    for i in range(10):
        engine._runs.append(RunRecord("p", f"ts-{i}", "success", "ok"))

    assert len(engine.get_recent_runs(limit=3)) == 3


def test_runs_capped_at_200():
    engine = _make_engine()
    for i in range(210):
        engine._record_run_end("agent", f"agent-{i}", "success", str(i))

    assert len(engine._runs) == 200


# ---------------------------------------------------------------------------
# Job metadata (pure Python)
# ---------------------------------------------------------------------------


def test_list_jobs_empty():
    engine = _make_engine()
    assert engine.list_jobs() == []


def test_active_job_count():
    engine = _make_engine()
    from mee6.scheduler.engine import TriggerMeta

    engine._jobs["a"] = TriggerMeta(
        id="a", pipeline_id="p1", pipeline_name="A", cron_expr="* * * * *", enabled=True
    )
    engine._jobs["b"] = TriggerMeta(
        id="b", pipeline_id="p2", pipeline_name="B", cron_expr="* * * * *", enabled=False
    )
    engine._jobs["c"] = TriggerMeta(
        id="c", pipeline_id="p3", pipeline_name="C", cron_expr="* * * * *", enabled=True
    )

    assert engine.active_job_count() == 2


# ---------------------------------------------------------------------------
# add_trigger / remove_trigger / toggle_trigger
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_trigger_registers_job():
    engine = _make_engine()

    with patch("mee6.scheduler.engine.AsyncSessionLocal") as mock_session_cls:
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_session = MagicMock()
        mock_session.merge = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session_cls.return_value.__aenter__.return_value = mock_session

        # Mock pipeline_store to return a pipeline with name "My Pipeline"
        with patch("mee6.pipelines.store.pipeline_store") as mock_store:
            mock_pipeline = MagicMock()
            mock_pipeline.name = "My Pipeline"
            mock_store.get = AsyncMock(return_value=mock_pipeline)

            job_id = await engine.add_trigger("pipe-1", "0 8 * * *", enabled=True)

    assert job_id in engine._jobs
    meta = engine._jobs[job_id]
    assert meta.pipeline_id == "pipe-1"
    assert meta.pipeline_name == "My Pipeline"
    assert meta.cron_expr == "0 8 * * *"
    assert meta.enabled is True
    engine._apscheduler.add_schedule.assert_awaited_once()


@pytest.mark.asyncio
async def test_add_trigger_paused_when_disabled():
    engine = _make_engine()

    with patch("mee6.scheduler.engine.AsyncSessionLocal") as mock_session_cls:
        mock_session = MagicMock()
        mock_session.merge = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # Mock pipeline_store
        with patch("mee6.pipelines.store.pipeline_store") as mock_store:
            mock_pipeline = MagicMock()
            mock_pipeline.name = "My Pipeline"
            mock_store.get = AsyncMock(return_value=mock_pipeline)

            await engine.add_trigger("pipe-1", "0 8 * * *", enabled=False)

    _, kwargs = engine._apscheduler.add_schedule.call_args
    assert kwargs["paused"] is True


@pytest.mark.asyncio
async def test_remove_trigger_deletes_job():
    engine = _make_engine()

    with patch("mee6.scheduler.engine.AsyncSessionLocal") as mock_session_cls:
        mock_session = MagicMock()
        mock_session.merge = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # Mock pipeline_store
        with patch("mee6.pipelines.store.pipeline_store") as mock_store:
            mock_pipeline = MagicMock()
            mock_pipeline.name = "My Pipeline"
            mock_store.get = AsyncMock(return_value=mock_pipeline)

            job_id = await engine.add_trigger("pipe-1", "0 8 * * *")
            await engine.remove_trigger(job_id)

    assert job_id not in engine._jobs
    engine._apscheduler.remove_schedule.assert_awaited_once_with(job_id)


@pytest.mark.asyncio
async def test_remove_trigger_unknown_id_is_noop():
    engine = _make_engine()

    with patch("mee6.scheduler.engine.AsyncSessionLocal") as mock_session_cls:
        mock_session = MagicMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # Removing a non-existent trigger should not raise an exception
        await engine.remove_trigger("nonexistent")


@pytest.mark.asyncio
async def test_toggle_trigger_disables_enabled_job():
    engine = _make_engine()

    with patch("mee6.scheduler.engine.AsyncSessionLocal") as mock_session_cls:
        mock_session = MagicMock()
        mock_session.merge = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # Mock pipeline_store
        with patch("mee6.pipelines.store.pipeline_store") as mock_store:
            mock_pipeline = MagicMock()
            mock_pipeline.name = "My Pipeline"
            mock_store.get = AsyncMock(return_value=mock_pipeline)

            job_id = await engine.add_trigger("pipe-1", "0 8 * * *", enabled=True)
            await engine.toggle_trigger(job_id)

    assert engine._jobs[job_id].enabled is False
    engine._apscheduler.pause_schedule.assert_awaited_once_with(job_id)


@pytest.mark.asyncio
async def test_toggle_trigger_enables_paused_job():
    engine = _make_engine()

    with patch("mee6.scheduler.engine.AsyncSessionLocal") as mock_session_cls:
        mock_session = MagicMock()
        mock_session.merge = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # Mock pipeline_store
        with patch("mee6.pipelines.store.pipeline_store") as mock_store:
            mock_pipeline = MagicMock()
            mock_pipeline.name = "My Pipeline"
            mock_store.get = AsyncMock(return_value=mock_pipeline)

            job_id = await engine.add_trigger("pipe-1", "0 8 * * *", enabled=False)
            await engine.toggle_trigger(job_id)

    assert engine._jobs[job_id].enabled is True
    engine._apscheduler.unpause_schedule.assert_awaited_once_with(job_id)


@pytest.mark.asyncio
async def test_toggle_trigger_unknown_id_is_noop():
    engine = _make_engine()
    await engine.toggle_trigger("nonexistent")  # should not raise


# ---------------------------------------------------------------------------
# _dispatch_pipeline
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dispatch_pipeline_success():
    from mee6.pipelines.models import Pipeline

    mock_pipeline = Pipeline(id="p1", name="test-pipeline", steps=[])
    mock_store = MagicMock()
    mock_store.get = AsyncMock(return_value=mock_pipeline)
    mock_run = AsyncMock(return_value={"summary": "2 step(s) completed"})

    with (
        patch("mee6.scheduler.engine.scheduler") as mock_engine,
        patch("mee6.pipelines.store.pipeline_store", mock_store),
        patch("mee6.pipelines.executor.run_pipeline", mock_run),
        patch("mee6.scheduler.engine._db_write_run", AsyncMock()),
    ):
        await _dispatch_pipeline("p1")

        mock_engine._record_run_start.assert_called_once_with("p1")
        mock_engine._record_run_end.assert_called_once_with(
            "p1", "test-pipeline", "success", "2 step(s) completed"
        )


@pytest.mark.asyncio
async def test_dispatch_pipeline_not_found():
    mock_store = MagicMock()
    mock_store.get = AsyncMock(return_value=None)

    with (
        patch("mee6.scheduler.engine.scheduler") as mock_engine,
        patch("mee6.pipelines.store.pipeline_store", mock_store),
        patch("mee6.scheduler.engine._db_write_run", AsyncMock()),
    ):
        await _dispatch_pipeline("missing-id")

        mock_engine._record_run_end.assert_called_once()
        args = mock_engine._record_run_end.call_args[0]
        assert args[1] == "error"
        assert "missing-id" in args[2]


@pytest.mark.asyncio
async def test_dispatch_pipeline_records_error_on_exception():
    from mee6.pipelines.models import Pipeline

    mock_pipeline = Pipeline(id="p1", name="test-pipeline", steps=[])
    mock_store = MagicMock()
    mock_store.get = AsyncMock(return_value=mock_pipeline)
    mock_run = AsyncMock(side_effect=RuntimeError("something went wrong"))

    with (
        patch("mee6.scheduler.engine.scheduler") as mock_engine,
        patch("mee6.pipelines.store.pipeline_store", mock_store),
        patch("mee6.pipelines.executor.run_pipeline", mock_run),
        patch("mee6.scheduler.engine._db_write_run", AsyncMock()),
    ):
        await _dispatch_pipeline("p1")

        args = mock_engine._record_run_end.call_args[0]
        assert args[0] == "p1"
        assert args[1] == "test-pipeline"
        assert args[2] == "error"
        assert "something went wrong" in args[3]
