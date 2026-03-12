"""APScheduler 4.x engine for mee6.

Triggers and their cron schedules are persisted to data/triggers.json so they
survive restarts. Pipeline definitions live in data/pipelines.json (managed by
mee6.pipelines.store).

To switch to a persistent APScheduler data store (e.g. SQLite), replace
MemoryDataStore with SQLAlchemyDataStore:

    from apscheduler.datastores.sqlalchemy import SQLAlchemyDataStore
    _apscheduler = AsyncScheduler(
        data_store=SQLAlchemyDataStore("sqlite+aiosqlite:////app/data/scheduler.db")
    )
"""

import asyncio
import json
import uuid
from contextlib import AsyncExitStack
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from apscheduler import AsyncScheduler
from apscheduler.datastores.memory import MemoryDataStore
from apscheduler.triggers.cron import CronTrigger

_TRIGGERS_PATH = Path("data/triggers.json")


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
        # APScheduler 4.x must be used as an async context manager before any
        # methods can be called. We keep the exit stack alive until stop().
        self._exit_stack = AsyncExitStack()
        await self._exit_stack.__aenter__()
        await self._exit_stack.enter_async_context(self._apscheduler)
        await self._apscheduler.start_in_background()
        await self._load_triggers()

    async def stop(self) -> None:
        if self._exit_stack:
            await self._exit_stack.__aexit__(None, None, None)
            self._exit_stack = None

    async def add_trigger(
        self,
        pipeline_id: str,
        pipeline_name: str,
        cron_expr: str,
        *,
        enabled: bool = True,
    ) -> str:
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
        self._save_triggers()
        return job_id

    async def remove_trigger(self, job_id: str) -> None:
        await self._apscheduler.remove_schedule(job_id)
        self._jobs.pop(job_id, None)
        self._save_triggers()

    async def toggle_trigger(self, job_id: str) -> None:
        meta = self._jobs.get(job_id)
        if meta is None:
            return
        if meta.enabled:
            await self._apscheduler.pause_schedule(job_id)
            meta.enabled = False
        else:
            await self._apscheduler.unpause_schedule(job_id)
            meta.enabled = True
        self._save_triggers()

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

    def _save_triggers(self) -> None:
        _TRIGGERS_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = [
            {
                "id": meta.id,
                "pipeline_id": meta.pipeline_id,
                "pipeline_name": meta.pipeline_name,
                "cron_expr": meta.cron_expr,
                "enabled": meta.enabled,
            }
            for meta in self._jobs.values()
        ]
        tmp = _TRIGGERS_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2))
        tmp.replace(_TRIGGERS_PATH)

    async def _load_triggers(self) -> None:
        if not _TRIGGERS_PATH.exists():
            return
        try:
            items = json.loads(_TRIGGERS_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            return
        for item in items:
            job_id = item["id"]
            pipeline_id = item["pipeline_id"]
            pipeline_name = item.get("pipeline_name", pipeline_id)
            cron_expr = item["cron_expr"]
            enabled = item["enabled"]
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


# Singleton used by the FastAPI app and route handlers
scheduler = SchedulerEngine()


async def _dispatch_pipeline(pipeline_id: str) -> None:
    """Top-level coroutine dispatched by APScheduler; loads and runs the pipeline."""
    from mee6.pipelines.executor import run_pipeline
    from mee6.pipelines.store import pipeline_store

    pipeline = pipeline_store.get(pipeline_id)
    if pipeline is None:
        scheduler._record_run_end(pipeline_id, "error", f"Pipeline '{pipeline_id}' not found")
        return
    scheduler._record_run_start(pipeline.name)
    try:
        result = await run_pipeline(pipeline)
        scheduler._record_run_end(pipeline.name, "success", result["summary"])
    except Exception as exc:
        scheduler._record_run_end(pipeline.name, "error", str(exc))
