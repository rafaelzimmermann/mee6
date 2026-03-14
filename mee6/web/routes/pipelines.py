"""CRUD routes for pipelines and the agent-fields API endpoint."""

import json

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from mee6.pipelines.models import Pipeline
from mee6.pipelines.placeholders import AVAILABLE as PLACEHOLDER_HINTS
from mee6.pipelines.plugin_registry import AGENT_PLUGINS
from mee6.pipelines.store import pipeline_store
from mee6.web.templates_env import templates

router = APIRouter()


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
            "placeholder_hints_json": json.dumps(PLACEHOLDER_HINTS),
            "initial_pipeline_json": "null",
            "active_count": 0,
        },
    )


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
            "placeholder_hints_json": json.dumps(PLACEHOLDER_HINTS),
            "initial_pipeline_json": pipeline.model_dump_json(),
            "active_count": 0,
        },
    )
