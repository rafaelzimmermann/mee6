"""REST API routes for agent plugins.

All endpoints return JSON responses for frontend consumption.
"""

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from mee6.pipelines.plugin_registry import AGENT_PLUGINS
from mee6.pipelines.placeholders import AVAILABLE as PLACEHOLDER_HINTS
from mee6.web.api.models import AgentResponse, FieldSchemaResponse
from mee6.web.templates_env import templates

router = APIRouter()


class AgentFieldsRequest(BaseModel):
    """Request model for agent fields endpoint."""

    step_index: int = 0
    config: dict = {}


@router.get("", response_model=list[AgentResponse])
async def list_agents():
    """List all available agent plugins."""
    return [
        AgentResponse(name=p.name, label=p.label) for p in AGENT_PLUGINS.values()
    ]


@router.get("/fields/batch", response_model=dict[str, list[FieldSchemaResponse]])
async def get_all_agent_fields():
    """Get field schemas for all agent types in a single request.

    Returns a dictionary mapping agent names to their field definitions.
    """
    result = {}
    for agent_name, plugin in AGENT_PLUGINS.items():
        fields = await plugin.get_fields()
        result[agent_name] = [
            FieldSchemaResponse(
                name=f.name,
                label=f.label,
                field_type=f.field_type,
                placeholder=f.placeholder,
                required=f.required,
                options=f.options,
            )
            for f in fields
        ]
    return result


@router.get("/{agent_type}/fields", response_model=list[FieldSchemaResponse])
async def get_agent_fields_schema(agent_type: str):
    """Get the field schema for an agent type.

    Returns JSON with field definitions for building dynamic forms.
    """
    plugin = AGENT_PLUGINS.get(agent_type)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent type not found"
        )
    fields = await plugin.get_fields()
    return [
        FieldSchemaResponse(
            name=f.name,
            label=f.label,
            field_type=f.field_type,
            placeholder=f.placeholder,
            required=f.required,
            options=f.options,
        )
        for f in fields
    ]


@router.post("/{agent_type}/fields", response_class=HTMLResponse)
async def render_agent_fields(
    request: Request, agent_type: str, data: AgentFieldsRequest = None
):
    """Render HTML form fields for an agent type.

    This endpoint is used for the existing template-based UI.
    It returns rendered HTML input fields.
    """
    plugin = AGENT_PLUGINS.get(agent_type)
    if not plugin:
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
