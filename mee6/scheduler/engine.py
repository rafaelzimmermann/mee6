"""APScheduler 4.x engine for mee6.

Triggers are persisted to PostgreSQL so they survive restarts.
Run records are written to PostgreSQL and cached in memory for the current session.
"""

import asyncio
import uuid
from contextlib import AsyncExitStack
from dataclasses import dataclass
from datetime import datetime

from apscheduler import AsyncScheduler
from apscheduler.datastores.memory import MemoryDataStore
from apscheduler.triggers.cron import CronTrigger

from mee6.db.engine import AsyncSessionLocal


@dataclass
class TriggerMeta:
    id: str
    pipeline_id: str
    pipeline_name: str
    cron_expr: str
    enabled: bool


@dataclass
class RunRecord:
    pipeline_name: str
    timestamp: str
    status: str
    summary: str


class SchedulerEngine:
    def __init__(self) -> None:
        self._apscheduler = AsyncScheduler(data_store=MemoryDataStore())
        self._jobs: dict[str, TriggerMeta] = {}
        self._runs: list[RunRecord] = []
        self._pending_run: dict[str, str] = {}
        self._exit_stack: AsyncExitStack | None = None

    async def start(self) -> None:
        self._exit_stack = AsyncExitStack()
        await self._exit_stack.__aenter__()
        await self._exit_stack.enter_async_context(self._apscheduler)
        await self._apscheduler.start_in_background()
        await self._load_from_db()

    async def stop(self) -> None:
        if self._exit_stack:
            await self._exit_stack.__aexit__(None, None, None)
            self._exit_stack = None

    async def _load_from_db(self) -> None:
        from mee6.db.repository import RunRecordRepository, TriggerRepository

        async with AsyncSessionLocal() as session:
            for row in await TriggerRepository(session).list_all():
                trigger = CronTrigger.from_crontab(row.cron_expr)
                await self._apscheduler.add_schedule(
                    _dispatch_pipeline,
                    trigger,
                    id=row.id,
                    kwargs={"pipeline_id": row.pipeline_id},
                    paused=not row.enabled,
                )
                self._jobs[row.id] = TriggerMeta(
                    id=row.id,
                    pipeline_id=row.pipeline_id,
                    pipeline_name=row.pipeline_name,
                    cron_expr=row.cron_expr,
                    enabled=row.enabled,
                )

        async with AsyncSessionLocal() as session:
            rows = await RunRecordRepository(session).list_recent(200)
            # list_recent returns newest-first; reverse for oldest-first cache
            self._runs = [
                RunRecord(
                    pipeline_name=r.pipeline_name,
                    timestamp=r.timestamp.isoformat(timespec="seconds"),
                    status=r.status,
                    summary=r.summary,
                )
                for r in reversed(rows)
            ]

    async def add_trigger(
        self,
        pipeline_id: str,
        pipeline_name: str,
        cron_expr: str,
        *,
        enabled: bool = True,
    ) -> str:
        from mee6.db.models import TriggerRow
        from mee6.db.repository import TriggerRepository

        job_id = str(uuid.uuid4())
        trigger = CronTrigger.from_crontab(cron_expr)
        await self._apscheduler.add_schedule(
            _dispatch_pipeline,
            trigger,
            id=job_id,
            kwargs={"pipeline_id": pipeline_id},
            paused=not enabled,
        )
        self._jobs[job_id] = TriggerMeta(
            id=job_id,
            pipeline_id=pipeline_id,
            pipeline_name=pipeline_name,
            cron_expr=cron_expr,
            enabled=enabled,
        )
        async with AsyncSessionLocal() as session:
            await TriggerRepository(session).upsert(
                TriggerRow(
                    id=job_id,
                    pipeline_id=pipeline_id,
                    pipeline_name=pipeline_name,
                    cron_expr=cron_expr,
                    enabled=enabled,
                )
            )
        return job_id

    async def remove_trigger(self, job_id: str) -> None:
        from mee6.db.repository import TriggerRepository

        await self._apscheduler.remove_schedule(job_id)
        self._jobs.pop(job_id, None)
        async with AsyncSessionLocal() as session:
            await TriggerRepository(session).delete(job_id)

    async def toggle_trigger(self, job_id: str) -> None:
        from mee6.db.repository import TriggerRepository

        meta = self._jobs.get(job_id)
        if meta is None:
            return
        if meta.enabled:
            await self._apscheduler.pause_schedule(job_id)
            meta.enabled = False
        else:
            await self._apscheduler.unpause_schedule(job_id)
            meta.enabled = True
        async with AsyncSessionLocal() as session:
            await TriggerRepository(session).set_enabled(job_id, enabled=meta.enabled)

    async def run_now(self, job_id: str) -> None:
        meta = self._jobs.get(job_id)
        if meta is None:
            return
        asyncio.create_task(_dispatch_pipeline(pipeline_id=meta.pipeline_id))

    def list_jobs(self) -> list[TriggerMeta]:
        return list(self._jobs.values())

    def active_job_count(self) -> int:
        return sum(1 for j in self._jobs.values() if j.enabled)

    def get_recent_runs(self, limit: int = 50) -> list[RunRecord]:
        return list(reversed(self._runs[-limit:]))

    def _record_run_start(self, pipeline_name: str) -> None:
        self._pending_run[pipeline_name] = datetime.now().isoformat(timespec="seconds")

    def _record_run_end(self, pipeline_name: str, status: str, summary: str) -> None:
        ts = self._pending_run.pop(pipeline_name, datetime.now().isoformat(timespec="seconds"))
        self._runs.append(
            RunRecord(pipeline_name=pipeline_name, timestamp=ts, status=status, summary=summary)
        )
        if len(self._runs) > 200:
            self._runs = self._runs[-200:]


# Singleton used by the FastAPI app and route handlers
scheduler = SchedulerEngine()


async def _db_write_run(
    pipeline_id: str, pipeline_name: str, status: str, summary: str, timestamp: str
) -> None:
    from mee6.db.models import RunRecordRow

    async with AsyncSessionLocal() as session:
        session.add(
            RunRecordRow(
                pipeline_id=pipeline_id,
                pipeline_name=pipeline_name,
                timestamp=datetime.fromisoformat(timestamp),
                status=status,
                summary=summary,
            )
        )
        await session.commit()


async def _dispatch_pipeline(pipeline_id: str) -> None:
    """Top-level coroutine dispatched by APScheduler; loads and runs the pipeline."""
    from mee6.pipelines.executor import run_pipeline
    from mee6.pipelines.store import pipeline_store

    pipeline = await pipeline_store.get(pipeline_id)
    if pipeline is None:
        msg = f"Pipeline '{pipeline_id}' not found"
        ts = datetime.now().isoformat(timespec="seconds")
        scheduler._record_run_end(pipeline_id, "error", msg)
        await _db_write_run(pipeline_id, pipeline_id, "error", msg, ts)
        return

    scheduler._record_run_start(pipeline.name)
    # Capture timestamp before any awaits
    ts = scheduler._pending_run.get(pipeline.name, datetime.now().isoformat(timespec="seconds"))
    try:
        result = await run_pipeline(pipeline)
        status, summary = "success", result["summary"]
    except Exception as exc:
        status, summary = "error", str(exc)

    scheduler._record_run_end(pipeline.name, status, summary)
    await _db_write_run(pipeline_id, pipeline.name, status, summary, ts)
