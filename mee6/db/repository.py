from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from mee6.db.models import CalendarRow, PipelineRow, RunRecordRow, TriggerRow, WhatsAppGroupRow, WhatsAppMessageRow


class PipelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def list_all(self) -> list[PipelineRow]:
        result = await self._s.execute(select(PipelineRow))
        return list(result.scalars())

    async def get(self, pipeline_id: str) -> PipelineRow | None:
        result = await self._s.execute(
            select(PipelineRow).where(PipelineRow.id == pipeline_id)
        )
        return result.scalar_one_or_none()

    async def upsert(self, row: PipelineRow) -> None:
        await self._s.merge(row)
        await self._s.commit()

    async def delete(self, pipeline_id: str) -> None:
        await self._s.execute(delete(PipelineRow).where(PipelineRow.id == pipeline_id))
        await self._s.commit()


class TriggerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def list_all(self) -> list[TriggerRow]:
        result = await self._s.execute(select(TriggerRow))
        return list(result.scalars())

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
        result = await self._s.execute(
            select(CalendarRow).where(CalendarRow.label == label)
        )
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
        result = await self._s.execute(
            select(WhatsAppGroupRow).order_by(WhatsAppGroupRow.name)
        )
        return list(result.scalars())

    async def get(self, jid: str) -> WhatsAppGroupRow | None:
        result = await self._s.execute(
            select(WhatsAppGroupRow).where(WhatsAppGroupRow.jid == jid)
        )
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
        await self._s.execute(
            delete(WhatsAppGroupRow).where(WhatsAppGroupRow.jid == jid)
        )
        await self._s.commit()
