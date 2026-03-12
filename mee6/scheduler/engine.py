"""APScheduler 4.x engine for mee6.

Triggers are persisted to PostgreSQL so they survive restarts.
Run records are written to PostgreSQL and cached in memory for the current session.
"""

import asyncio
import logging
import uuid
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

from apscheduler import AsyncScheduler
from apscheduler.datastores.memory import MemoryDataStore
from apscheduler.triggers.cron import CronTrigger

from mee6.db.engine import AsyncSessionLocal


class TriggerType(str, Enum):
    CRON = "cron"
    WHATSAPP = "whatsapp"
    WA_GROUP = "wa_group"


@dataclass
class TriggerMeta:
    id: str
    pipeline_id: str
    pipeline_name: str
    enabled: bool
    trigger_type: TriggerType = TriggerType.CRON
    cron_expr: str | None = None
    config: dict = field(default_factory=dict)


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
        # WA DM triggers indexed by job_id (subset of _jobs)
        self._wa_triggers: dict[str, TriggerMeta] = {}
        # WA group triggers indexed by job_id (subset of _jobs)
        self._wa_group_triggers: dict[str, TriggerMeta] = {}
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
                trigger_type = TriggerType(getattr(row, "trigger_type", None) or TriggerType.CRON)
                config = getattr(row, "config", None) or {}
                meta = TriggerMeta(
                    id=row.id,
                    pipeline_id=row.pipeline_id,
                    pipeline_name=row.pipeline_name,
                    enabled=row.enabled,
                    trigger_type=trigger_type,
                    cron_expr=row.cron_expr,
                    config=config,
                )
                self._jobs[row.id] = meta
                if trigger_type == TriggerType.WHATSAPP:
                    self._wa_triggers[row.id] = meta
                elif trigger_type == TriggerType.WA_GROUP:
                    self._wa_group_triggers[row.id] = meta
                else:
                    apscheduler_trigger = CronTrigger.from_crontab(row.cron_expr)
                    await self._apscheduler.add_schedule(
                        _dispatch_pipeline,
                        apscheduler_trigger,
                        id=row.id,
                        kwargs={"pipeline_id": row.pipeline_id},
                        paused=not row.enabled,
                    )

        async with AsyncSessionLocal() as session:
            rows = await RunRecordRepository(session).list_recent(_MAX_RUN_HISTORY)
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
        apscheduler_trigger = CronTrigger.from_crontab(cron_expr)
        await self._apscheduler.add_schedule(
            _dispatch_pipeline,
            apscheduler_trigger,
            id=job_id,
            kwargs={"pipeline_id": pipeline_id},
            paused=not enabled,
        )
        meta = TriggerMeta(
            id=job_id,
            pipeline_id=pipeline_id,
            pipeline_name=pipeline_name,
            enabled=enabled,
            trigger_type=TriggerType.CRON,
            cron_expr=cron_expr,
        )
        self._jobs[job_id] = meta
        async with AsyncSessionLocal() as session:
            await TriggerRepository(session).upsert(
                TriggerRow(
                    id=job_id,
                    pipeline_id=pipeline_id,
                    pipeline_name=pipeline_name,
                    trigger_type=TriggerType.CRON,
                    cron_expr=cron_expr,
                    enabled=enabled,
                )
            )
        return job_id

    async def add_whatsapp_trigger(
        self,
        pipeline_id: str,
        pipeline_name: str,
        phone: str,
        *,
        enabled: bool = True,
    ) -> str:
        from mee6.db.models import TriggerRow
        from mee6.db.repository import TriggerRepository

        job_id = str(uuid.uuid4())
        config = {"phone": phone}
        meta = TriggerMeta(
            id=job_id,
            pipeline_id=pipeline_id,
            pipeline_name=pipeline_name,
            enabled=enabled,
            trigger_type=TriggerType.WHATSAPP,
            config=config,
        )
        self._jobs[job_id] = meta
        self._wa_triggers[job_id] = meta
        async with AsyncSessionLocal() as session:
            await TriggerRepository(session).upsert(
                TriggerRow(
                    id=job_id,
                    pipeline_id=pipeline_id,
                    pipeline_name=pipeline_name,
                    trigger_type=TriggerType.WHATSAPP,
                    config=config,
                    enabled=enabled,
                )
            )
        return job_id

    async def add_wa_group_trigger(
        self,
        pipeline_id: str,
        pipeline_name: str,
        group_jid: str,
        *,
        enabled: bool = True,
    ) -> str:
        from mee6.db.models import TriggerRow
        from mee6.db.repository import TriggerRepository

        job_id = str(uuid.uuid4())
        config = {"group_jid": group_jid}
        meta = TriggerMeta(
            id=job_id,
            pipeline_id=pipeline_id,
            pipeline_name=pipeline_name,
            enabled=enabled,
            trigger_type=TriggerType.WA_GROUP,
            config=config,
        )
        self._jobs[job_id] = meta
        self._wa_group_triggers[job_id] = meta
        async with AsyncSessionLocal() as session:
            await TriggerRepository(session).upsert(
                TriggerRow(
                    id=job_id,
                    pipeline_id=pipeline_id,
                    pipeline_name=pipeline_name,
                    trigger_type=TriggerType.WA_GROUP,
                    config=config,
                    enabled=enabled,
                )
            )
        return job_id

    async def remove_trigger(self, job_id: str) -> None:
        from mee6.db.repository import TriggerRepository

        meta = self._jobs.get(job_id)
        if meta and meta.trigger_type not in (TriggerType.WHATSAPP, TriggerType.WA_GROUP):
            await self._apscheduler.remove_schedule(job_id)
        self._jobs.pop(job_id, None)
        self._wa_triggers.pop(job_id, None)
        self._wa_group_triggers.pop(job_id, None)
        async with AsyncSessionLocal() as session:
            await TriggerRepository(session).delete(job_id)

    async def toggle_trigger(self, job_id: str) -> None:
        from mee6.db.repository import TriggerRepository

        meta = self._jobs.get(job_id)
        if meta is None:
            return
        meta.enabled = not meta.enabled
        if meta.trigger_type not in (TriggerType.WHATSAPP, TriggerType.WA_GROUP):
            if meta.enabled:
                await self._apscheduler.unpause_schedule(job_id)
            else:
                await self._apscheduler.pause_schedule(job_id)
        async with AsyncSessionLocal() as session:
            await TriggerRepository(session).set_enabled(job_id, enabled=meta.enabled)

    async def run_now(self, job_id: str) -> None:
        meta = self._jobs.get(job_id)
        if meta is None:
            return
        asyncio.create_task(_dispatch_pipeline(pipeline_id=meta.pipeline_id))

    def _check_event_triggers(
        self, triggers: dict, config_key: str, incoming_id: str, label: str
    ) -> None:
        """Iterate *triggers*, dispatching any enabled entry whose config[config_key] matches *incoming_id*."""
        logger.info("%s: id=%s, %d trigger(s) registered", label, incoming_id, len(triggers))
        for meta in triggers.values():
            if not meta.enabled:
                continue
            if meta.config.get(config_key, "") == incoming_id:
                logger.info("%s: match! dispatching pipeline %s", label, meta.pipeline_id)
                asyncio.create_task(_dispatch_pipeline(pipeline_id=meta.pipeline_id))

    def check_wa_triggers(self, sender: str) -> None:
        """Called when an incoming WA DM is stored. Dispatches any matching enabled triggers."""
        # sender is digits-only (no '+').  Trigger phone may have a leading '+'.
        sender_norm = sender.lstrip("+")
        # Normalise trigger phones too before comparing
        normalised = {
            k: v for k, v in self._wa_triggers.items()
            if v.config.get("phone", "").lstrip("+") == sender_norm
        }
        self._check_event_triggers(normalised, "phone", sender_norm, "check_wa_triggers")

    def check_wa_group_triggers(self, chat_id: str) -> None:
        """Called when a group message is stored. Dispatches matching enabled triggers."""
        self._check_event_triggers(
            self._wa_group_triggers, "group_jid", chat_id, "check_wa_group_triggers"
        )

    def list_jobs(self) -> list[TriggerMeta]:
        return list(self._jobs.values())

    def active_job_count(self) -> int:
        return sum(1 for j in self._jobs.values() if j.enabled)

    def get_recent_runs(self, limit: int = 50) -> list[RunRecord]:
        return list(reversed(self._runs[-limit:]))

    def _record_run_start(self, pipeline_id: str) -> None:
        self._pending_run[pipeline_id] = datetime.now().isoformat(timespec="seconds")

    def _record_run_end(self, pipeline_id: str, pipeline_name: str, status: str, summary: str) -> None:
        ts = self._pending_run.pop(pipeline_id, datetime.now().isoformat(timespec="seconds"))
        self._runs.append(
            RunRecord(pipeline_name=pipeline_name, timestamp=ts, status=status, summary=summary)
        )
        if len(self._runs) > _MAX_RUN_HISTORY:
            self._runs = self._runs[-_MAX_RUN_HISTORY:]


_MAX_RUN_HISTORY = 200

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

    scheduler._record_run_start(pipeline.id)
    # Capture timestamp before any awaits
    ts = scheduler._pending_run.get(pipeline.id, datetime.now().isoformat(timespec="seconds"))
    try:
        result = await run_pipeline(pipeline)
        status, summary = "success", result["summary"]
    except Exception as exc:
        logger.exception("Pipeline '%s' failed", pipeline.name)
        status, summary = "error", str(exc)

    scheduler._record_run_end(pipeline.id, pipeline.name, status, summary)
    await _db_write_run(pipeline_id, pipeline.name, status, summary, ts)
