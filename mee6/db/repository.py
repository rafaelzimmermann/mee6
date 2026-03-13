from datetime import datetime
from typing import Optional

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from mee6.db.models import (
    CalendarRow,
    PipelineMemoryRow,
    PipelineRow,
    PipelineStepRow,
    RunRecordRow,
    TriggerRow,
    WhatsAppGroupRow,
    WhatsAppMessageRow,
    WhatsAppSettingsRow,
)


class PipelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def list_all(self) -> list[PipelineRow]:
        result = await self._s.execute(select(PipelineRow))
        return list(result.scalars())

    async def get(self, pipeline_id: str) -> PipelineRow | None:
        result = await self._s.execute(select(PipelineRow).where(PipelineRow.id == pipeline_id))
        return result.scalar_one_or_none()

    async def upsert(self, row: PipelineRow) -> None:
        await self._s.merge(row)
        await self._s.commit()

    async def delete(self, pipeline_id: str) -> None:
        await self._s.execute(delete(PipelineRow).where(PipelineRow.id == pipeline_id))
        await self._s.commit()


class PipelineStepRepository:
    """Repository for individual pipeline steps stored in pipeline_steps table."""

    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def list_by_pipeline(self, pipeline_id: str) -> list[PipelineStepRow]:
        """Get all steps for a pipeline, ordered by step_index."""
        result = await self._s.execute(
            select(PipelineStepRow)
            .where(PipelineStepRow.pipeline_id == pipeline_id)
            .order_by(PipelineStepRow.step_index)
        )
        return list(result.scalars())

    async def upsert_steps(
        self, pipeline_id: str, steps: list[PipelineStepRow]
    ) -> None:
        """Upsert all steps for a pipeline.

        This method deletes all existing steps for this pipeline
        and inserts new steps, replacing them entirely.

        Args:
            pipeline_id: The pipeline ID
            steps: List of PipelineStepRow objects with pipeline_id and step_index set
        """
        # Delete all existing steps for this pipeline
        await self._s.execute(
            delete(PipelineStepRow).where(PipelineStepRow.pipeline_id == pipeline_id)
        )

        # Insert new steps
        for step in steps:
            self._s.add(step)

        await self._s.commit()

    async def delete_by_pipeline(self, pipeline_id: str) -> None:
        """Delete all steps for a pipeline."""
        await self._s.execute(
            delete(PipelineStepRow).where(PipelineStepRow.pipeline_id == pipeline_id)
        )
        await self._s.commit()


class TriggerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def list_all(self) -> list[TriggerRow]:
        result = await self._s.execute(select(TriggerRow))
        return list(result.scalars())

    async def exists_for_pipeline(self, pipeline_id: str) -> bool:
        result = await self._s.execute(
            select(TriggerRow.id).where(TriggerRow.pipeline_id == pipeline_id).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def upsert(self, row: TriggerRow) -> None:
        await self._s.merge(row)
        await self._s.commit()

    async def delete(self, trigger_id: str) -> None:
        await self._s.execute(delete(TriggerRow).where(TriggerRow.id == trigger_id))
        await self._s.commit()

    async def set_enabled(self, trigger_id: str, *, enabled: bool) -> None:
        await self._s.execute(
            update(TriggerRow).where(TriggerRow.id == trigger_id).values(enabled=enabled)
        )
        await self._s.commit()


class RunRecordRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def insert(self, row: RunRecordRow) -> None:
        self._s.add(row)
        await self._s.commit()

    async def list_recent(self, limit: int = 50) -> list[RunRecordRow]:
        result = await self._s.execute(
            select(RunRecordRow).order_by(RunRecordRow.timestamp.desc()).limit(limit)
        )
        return list(result.scalars())


class CalendarRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def list_all(self) -> list[CalendarRow]:
        result = await self._s.execute(select(CalendarRow).order_by(CalendarRow.label))
        return list(result.scalars())

    async def get_by_label(self, label: str) -> CalendarRow | None:
        result = await self._s.execute(select(CalendarRow).where(CalendarRow.label == label))
        return result.scalar_one_or_none()

    async def upsert(self, row: CalendarRow) -> None:
        await self._s.merge(row)
        await self._s.commit()

    async def delete(self, cal_id: str) -> None:
        await self._s.execute(delete(CalendarRow).where(CalendarRow.id == cal_id))
        await self._s.commit()


class WhatsAppMessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def insert(self, row: WhatsAppMessageRow) -> None:
        self._s.add(row)
        await self._s.commit()

    async def get_recent_from(self, sender: str, limit: int) -> list[WhatsAppMessageRow]:
        """Return the most recent *limit* DMs from *sender*, oldest first."""
        result = await self._s.execute(
            select(WhatsAppMessageRow)
            .where(WhatsAppMessageRow.sender == sender)
            .where(WhatsAppMessageRow.chat_id.is_(None))
            .order_by(WhatsAppMessageRow.timestamp.desc())
            .limit(limit)
        )
        rows = list(result.scalars())
        rows.reverse()
        return rows

    async def get_recent_from_chat(self, chat_id: str, limit: int) -> list[WhatsAppMessageRow]:
        """Return the most recent *limit* messages from a group chat, oldest first."""
        result = await self._s.execute(
            select(WhatsAppMessageRow)
            .where(WhatsAppMessageRow.chat_id == chat_id)
            .order_by(WhatsAppMessageRow.timestamp.desc())
            .limit(limit)
        )
        rows = list(result.scalars())
        rows.reverse()
        return rows


class WhatsAppGroupRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def list_all(self) -> list[WhatsAppGroupRow]:
        result = await self._s.execute(select(WhatsAppGroupRow).order_by(WhatsAppGroupRow.name))
        return list(result.scalars())

    async def get(self, jid: str) -> WhatsAppGroupRow | None:
        result = await self._s.execute(select(WhatsAppGroupRow).where(WhatsAppGroupRow.jid == jid))
        return result.scalar_one_or_none()

    async def upsert(self, row: WhatsAppGroupRow) -> None:
        await self._s.merge(row)
        await self._s.commit()

    async def update_label(self, jid: str, label: str) -> None:
        await self._s.execute(
            update(WhatsAppGroupRow).where(WhatsAppGroupRow.jid == jid).values(label=label)
        )
        await self._s.commit()

    async def delete(self, jid: str) -> None:
        await self._s.execute(delete(WhatsAppGroupRow).where(WhatsAppGroupRow.jid == jid))
        await self._s.commit()


class WhatsAppSettingsRepository:
    _ID = "default"

    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_phone_number(self) -> str:
        result = await self._s.execute(
            select(WhatsAppSettingsRow).where(WhatsAppSettingsRow.id == self._ID)
        )
        row = result.scalar_one_or_none()
        return row.phone_number if row else ""

    async def set_phone_number(self, phone: str) -> None:
        await self._s.merge(WhatsAppSettingsRow(id=self._ID, phone_number=phone))
        await self._s.commit()


class PipelineMemoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_recent(
        self, pipeline_id: str, label: str, limit: int, since: Optional[datetime] = None
    ) -> list[PipelineMemoryRow]:
        """Return the most recent *limit* memories for pipeline_id/label, oldest first."""
        query = select(PipelineMemoryRow).where(
            PipelineMemoryRow.pipeline_id == pipeline_id,
            PipelineMemoryRow.label == label,
        )

        if since is not None:
            query = query.where(PipelineMemoryRow.created_at >= since)

        result = await self._s.execute(
            query.order_by(PipelineMemoryRow.created_at.desc()).limit(limit)
        )
        rows = list(result.scalars())
        rows.reverse()
        return rows

    async def insert(self, row: PipelineMemoryRow) -> None:
        self._s.add(row)
        await self._s.commit()

    async def count(self, pipeline_id: str, label: str) -> int:
        """Count memories for pipeline_id/label."""
        result = await self._s.execute(
            select(func.count(PipelineMemoryRow.id)).where(
                PipelineMemoryRow.pipeline_id == pipeline_id,
                PipelineMemoryRow.label == label,
            )
        )
        return result.scalar_one()

    async def delete_oldest(self, pipeline_id: str, label: str, keep: int) -> None:
        """Delete oldest memories beyond *keep* count."""
        subquery = (
            select(PipelineMemoryRow.id)
            .where(
                PipelineMemoryRow.pipeline_id == pipeline_id,
                PipelineMemoryRow.label == label,
            )
            .order_by(PipelineMemoryRow.created_at.desc())
            .offset(keep)
        )

        await self._s.execute(delete(PipelineMemoryRow).where(PipelineMemoryRow.id.in_(subquery)))
        await self._s.commit()

    async def delete_expired(self, pipeline_id: str, label: str, before: datetime) -> None:
        """Delete memories older than *before* timestamp."""
        await self._s.execute(
            delete(PipelineMemoryRow).where(
                PipelineMemoryRow.pipeline_id == pipeline_id,
                PipelineMemoryRow.label == label,
                PipelineMemoryRow.created_at < before,
            )
        )
        await self._s.commit()

    async def get_config(self, label: str) -> dict | None:
        """Get memory configuration for a label, or default values if not configured."""
        from mee6.db.models import PipelineMemoryConfig

        result = await self._s.execute(
            select(PipelineMemoryConfig).where(PipelineMemoryConfig.label == label)
        )
        config = result.scalar_one_or_none()

        if config is None:
            return {
                "label": label,
                "max_memories": 20,
                "ttl_hours": 720,
                "max_value_size": 2000,
            }

        return {
            "label": config.label,
            "max_memories": config.max_memories,
            "ttl_hours": config.ttl_hours,
            "max_value_size": config.max_value_size,
        }

    async def set_config(self, label: str, max_memories: int, ttl_hours: int, max_value_size: int) -> None:
        """Set memory configuration for a label."""
        from mee6.db.models import PipelineMemoryConfig

        config = PipelineMemoryConfig(
            label=label,
            max_memories=max_memories,
            ttl_hours=ttl_hours,
            max_value_size=max_value_size,
        )
        await self._s.merge(config)
        await self._s.commit()

    async def list_configs(self) -> list[dict]:
        """List all memory configurations."""
        from mee6.db.models import PipelineMemoryConfig

        result = await self._s.execute(select(PipelineMemoryConfig).order_by(PipelineMemoryConfig.label))
        configs = result.scalars().all()

        return [
            {
                "label": config.label,
                "max_memories": config.max_memories,
                "ttl_hours": config.ttl_hours,
                "max_value_size": config.max_value_size,
            }
            for config in configs
        ]

    async def delete_config(self, label: str) -> None:
        """Delete memory configuration for a label."""
        from mee6.db.models import PipelineMemoryConfig

        await self._s.execute(delete(PipelineMemoryConfig).where(PipelineMemoryConfig.label == label))
        await self._s.commit()
