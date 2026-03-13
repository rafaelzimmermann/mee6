"""CRUD routes for pipelines and the agent-fields API endpoint."""

import json
import urllib.parse
import uuid

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from pydantic import BaseModel

from mee6.db.engine import AsyncSessionLocal
from mee6.db.repository import TriggerRepository
from mee6.pipelines.models import Pipeline, PipelineStep
from mee6.pipelines.placeholders import AVAILABLE as PLACEHOLDER_HINTS
from mee6.pipelines.plugin_registry import AGENT_PLUGINS
from mee6.pipelines.store import pipeline_store
from mee6.scheduler.engine import scheduler
from mee6.web.templates_env import templates

router = APIRouter()


class PipelineCreateRequest(BaseModel):
    name: str
    steps: list[dict]


def _plugin_list_json() -> str:
    return json.dumps([{"name": p.name, "label": p.label} for p in AGENT_PLUGINS.values()])


@router.get("/pipelines", response_class=HTMLResponse)
async def list_pipelines(request: Request, error: str = ""):
    pipelines = await pipeline_store.list()
    return templates.TemplateResponse(
        request, "pipelines.html", {"pipelines": pipelines, "active_count": 0, "error": error}
    )


@router.get("/pipelines/new", response_class=HTMLResponse)
async def new_pipeline(request: Request):
    return templates.TemplateResponse(
        request,
        "pipeline_editor.html",
        {
            "pipeline": None,
            "plugin_list_json": _plugin_list_json(),
            "initial_pipeline_json": "null",
            "active_count": 0,
        },
    )


@router.post("/pipelines")
async def create_pipeline(data: PipelineCreateRequest):
    pipeline = Pipeline(
        id=str(uuid.uuid4()),
        name=data.name,
        steps=[PipelineStep(**step) for step in data.steps],
    )
    await pipeline_store.upsert(pipeline)
    return RedirectResponse("/pipelines", status_code=303)


@router.get("/pipelines/{pipeline_id}", response_class=HTMLResponse)
async def edit_pipeline(request: Request, pipeline_id: str):
    pipeline = await pipeline_store.get(pipeline_id)
    if pipeline is None:
        return RedirectResponse("/pipelines", status_code=303)
    return templates.TemplateResponse(
        request,
        "pipeline_editor.html",
        {
            "pipeline": pipeline,
            "plugin_list_json": _plugin_list_json(),
            "initial_pipeline_json": pipeline.model_dump_json(),
            "active_count": 0,
        },
    )


@router.post("/pipelines/{pipeline_id}")
async def update_pipeline(pipeline_id: str, data: PipelineCreateRequest):
    # Deprecated - use PUT /api/v1/pipelines/{pipeline_id} for JSON API
    # This route returns JSON instead of redirect for SPA
    pipeline = Pipeline(
        id=pipeline_id,
        name=data.name,
        steps=[PipelineStep(**step) for step in data.steps],
    )
    await pipeline_store.upsert(pipeline)
    scheduler.update_pipeline_name(pipeline_id, pipeline.name)
    return PipelineResponse(
        id=pipeline.id,
        name=pipeline.name,
        steps=[step.model_dump() for step in pipeline.steps],
    )


@router.post("/pipelines/{pipeline_id}/delete")
async def delete_pipeline(pipeline_id: str):
    async with AsyncSessionLocal() as session:
        if await TriggerRepository(session).exists_for_pipeline(pipeline_id):
            msg = urllib.parse.quote("Cannot delete: pipeline has associated triggers.")
            return RedirectResponse(f"/pipelines?error={msg}", status_code=303)
    await pipeline_store.delete(pipeline_id)
    return RedirectResponse("/pipelines", status_code=303)


class AgentFieldsRequest(BaseModel):
    step_index: int = 0
    config: dict = {}


@router.post("/api/agents/{agent_type}/fields", response_class=HTMLResponse)
async def get_agent_fields(
    request: Request,
    agent_type: str,
    data: AgentFieldsRequest = None,
):
    plugin = AGENT_PLUGINS.get(agent_type)
    if plugin is None:
        return HTMLResponse("")
    step_index = data.step_index if data else 0
    existing_config = data.config if data else {}
    fields = await plugin.get_fields()
    return templates.TemplateResponse(
        request,
        "_agent_fields.html",
        {
            "fields": fields,
            "step_index": step_index,
            "config": existing_config,
            "placeholder_hints": PLACEHOLDER_HINTS,
        },
    )
