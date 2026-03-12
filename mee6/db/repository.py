from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from mee6.db.models import PipelineRow, RunRecordRow, TriggerRow


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
