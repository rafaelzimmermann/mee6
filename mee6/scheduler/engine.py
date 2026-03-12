"""APScheduler 4.x engine for mee6.

Uses MemoryDataStore by default. For persistent schedules across restarts,
switch to SQLAlchemyDataStore:

    from apscheduler.datastores.sqlalchemy import SQLAlchemyDataStore
    _apscheduler = AsyncScheduler(
        data_store=SQLAlchemyDataStore("sqlite+aiosqlite:////app/data/scheduler.db")
    )

(requires aiosqlite and sqlalchemy packages)
"""

import asyncio
import uuid
from contextlib import AsyncExitStack
from dataclasses import dataclass
from datetime import datetime

from apscheduler import AsyncScheduler
from apscheduler.datastores.memory import MemoryDataStore
from apscheduler.triggers.cron import CronTrigger


@dataclass
class JobMeta:
    id: str
    agent_name: str
    cron_expr: str
    enabled: bool


@dataclass
class RunRecord:
    agent_name: str
    timestamp: str
    status: str
    summary: str


class SchedulerEngine:
    def __init__(self) -> None:
        self._apscheduler = AsyncScheduler(data_store=MemoryDataStore())
        self._jobs: dict[str, JobMeta] = {}
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

    async def stop(self) -> None:
        if self._exit_stack:
            await self._exit_stack.__aexit__(None, None, None)
            self._exit_stack = None

    async def add_trigger(self, agent_name: str, cron_expr: str, *, enabled: bool = True) -> str:
        job_id = str(uuid.uuid4())
        trigger = CronTrigger.from_crontab(cron_expr)
        await self._apscheduler.add_schedule(
            _dispatch_task,
            trigger,
            id=job_id,
            kwargs={"agent_name": agent_name},
            paused=not enabled,
        )
        self._jobs[job_id] = JobMeta(
            id=job_id,
            agent_name=agent_name,
            cron_expr=cron_expr,
            enabled=enabled,
        )
        return job_id

    async def remove_trigger(self, job_id: str) -> None:
        await self._apscheduler.remove_schedule(job_id)
        self._jobs.pop(job_id, None)

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

    async def run_now(self, job_id: str) -> None:
        meta = self._jobs.get(job_id)
        if meta is None:
            return
        asyncio.create_task(_dispatch_task(agent_name=meta.agent_name))

    def list_jobs(self) -> list[JobMeta]:
        return list(self._jobs.values())

    def active_job_count(self) -> int:
        return sum(1 for j in self._jobs.values() if j.enabled)

    def get_recent_runs(self, limit: int = 50) -> list[RunRecord]:
        return list(reversed(self._runs[-limit:]))

    def _record_run_start(self, agent_name: str) -> None:
        self._pending_run[agent_name] = datetime.now().isoformat(timespec="seconds")

    def _record_run_end(self, agent_name: str, status: str, summary: str) -> None:
        ts = self._pending_run.pop(agent_name, datetime.now().isoformat(timespec="seconds"))
        self._runs.append(
            RunRecord(agent_name=agent_name, timestamp=ts, status=status, summary=summary)
        )
        if len(self._runs) > 200:
            self._runs = self._runs[-200:]


# Singleton used by the FastAPI app and route handlers
scheduler = SchedulerEngine()


async def _dispatch_task(agent_name: str) -> None:
    """Top-level coroutine dispatched by APScheduler; looks up the task in the registry."""
    from mee6.scheduler.registry import TASK_REGISTRY

    scheduler._record_run_start(agent_name)
    task_fn = TASK_REGISTRY.get(agent_name)
    if task_fn is None:
        scheduler._record_run_end(agent_name, "error", f"No task registered for '{agent_name}'")
        return
    try:
        result = await task_fn()
        summary = str(result.get("summary", "OK")) if isinstance(result, dict) else "OK"
        scheduler._record_run_end(agent_name, "success", summary)
    except Exception as exc:
        scheduler._record_run_end(agent_name, "error", str(exc))
