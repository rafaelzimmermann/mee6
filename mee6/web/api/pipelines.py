"""REST API routes for pipelines.

All endpoints return JSON responses for frontend consumption.
"""

import uuid

from fastapi import APIRouter, HTTPException, status

from mee6.db.engine import AsyncSessionLocal
from mee6.db.models import PipelineStepRow
from mee6.db.repository import PipelineStepRepository, TriggerRepository
from mee6.pipelines.models import Pipeline
from mee6.pipelines.store import pipeline_store
from mee6.scheduler.engine import scheduler
from mee6.web.api.models import (
    PipelineCreateRequest,
    PipelineCreateResponse,
    PipelineResponse,
)

router = APIRouter()


@router.get("", response_model=list[PipelineResponse])
async def list_pipelines():
    """List all pipelines."""
    pipelines = await pipeline_store.list()
    return [
        PipelineResponse(
            id=p.id,
            name=p.name,
            steps=[step.model_dump() for step in p.steps],
        )
        for p in pipelines
    ]


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(pipeline_id: str):
    """Get a single pipeline by ID."""
    pipeline = await pipeline_store.get(pipeline_id)
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found"
        )
    return PipelineResponse(
        id=pipeline.id,
        name=pipeline.name,
        steps=[step.model_dump() for step in pipeline.steps],
    )


@router.post("", response_model=PipelineCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(data: PipelineCreateRequest):
    """Create a new pipeline."""
    pipeline_id = str(uuid.uuid4())
    await pipeline_store.upsert(Pipeline(id=pipeline_id, name=data.name))
    async with AsyncSessionLocal() as session:
        await PipelineStepRepository(session).upsert_steps(
            pipeline_id,
            [
                PipelineStepRow(
                    pipeline_id=pipeline_id,
                    step_index=idx,
                    agent_type=step.get("agent_type", ""),
                    config=step.get("config", {}),
                )
                for idx, step in enumerate(data.steps)
            ],
        )
    return PipelineCreateResponse(
        id=pipeline_id, message=f"Pipeline '{data.name}' created"
    )


@router.put("/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(pipeline_id: str, data: PipelineCreateRequest):
    """Update an existing pipeline."""
    existing = await pipeline_store.get(pipeline_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found"
        )

    pipeline = Pipeline(id=pipeline_id, name=data.name)
    await pipeline_store.upsert(pipeline)
    scheduler.update_pipeline_name(pipeline_id, pipeline.name)
    async with AsyncSessionLocal() as session:
        await PipelineStepRepository(session).upsert_steps(
            pipeline_id,
            [
                PipelineStepRow(
                    pipeline_id=pipeline_id,
                    step_index=idx,
                    agent_type=step.get("agent_type", ""),
                    config=step.get("config", {}),
                )
                for idx, step in enumerate(data.steps)
            ],
        )
    return PipelineResponse(id=pipeline_id, name=data.name, steps=data.steps)


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(pipeline_id: str):
    """Delete a pipeline.

    Fails with 400 if the pipeline has associated triggers.
    """
    async with AsyncSessionLocal() as session:
        if await TriggerRepository(session).exists_for_pipeline(pipeline_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete: pipeline has associated triggers",
            )
    await pipeline_store.delete(pipeline_id)
