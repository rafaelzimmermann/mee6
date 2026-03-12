"""PostgreSQL-backed persistence for pipelines."""

import uuid

from mee6.db.engine import AsyncSessionLocal
from mee6.db.models import PipelineRow
from mee6.db.repository import PipelineRepository
from mee6.pipelines.models import Pipeline, PipelineStep


def _row_to_pipeline(row: PipelineRow) -> Pipeline:
    return Pipeline(
        id=row.id,
        name=row.name,
        steps=[PipelineStep(**s) for s in row.steps],
    )


class PipelineStore:
    async def list(self) -> list[Pipeline]:
        async with AsyncSessionLocal() as session:
            rows = await PipelineRepository(session).list_all()
            return [_row_to_pipeline(r) for r in rows]

    async def get(self, pipeline_id: str) -> Pipeline | None:
        async with AsyncSessionLocal() as session:
            row = await PipelineRepository(session).get(pipeline_id)
            return _row_to_pipeline(row) if row else None

    async def upsert(self, pipeline: Pipeline) -> None:
        row = PipelineRow(
            id=pipeline.id,
            name=pipeline.name,
            steps=[s.model_dump() for s in pipeline.steps],
        )
        async with AsyncSessionLocal() as session:
            await PipelineRepository(session).upsert(row)

    async def delete(self, pipeline_id: str) -> None:
        async with AsyncSessionLocal() as session:
            await PipelineRepository(session).delete(pipeline_id)

    @staticmethod
    def new_id() -> str:
        return str(uuid.uuid4())


pipeline_store = PipelineStore()
