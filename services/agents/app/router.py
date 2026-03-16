from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx

from app.auth import require_auth
from app.config import config as app_config
from app.agents.llm_agent import LlmAgent, ANTHROPIC_MODELS
from app.agents.browser_agent import BrowserAgent
from app.agents.calendar_agent import CalendarAgent

router = APIRouter()

AGENT_REGISTRY: dict[str, object] = {
    "llm_agent": LlmAgent(),
    "browser_agent": BrowserAgent(),
    "calendar_agent": CalendarAgent(),
}


class RunRequest(BaseModel):
    agent_type: str
    config: dict
    input: str


@router.get("/models")
def list_models(provider: str = "anthropic"):
    """Returns available model names for the given provider."""
    if provider == "anthropic":
        return ANTHROPIC_MODELS
    if provider == "ollama":
        try:
            r = httpx.get(f"{app_config.ollama_base_url}/api/tags", timeout=5)
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
        except Exception:
            return []
    raise HTTPException(status_code=422, detail=f"Unknown provider: {provider}")


@router.get("/schema")
def get_schema():
    """Returns field definitions for all registered agents."""
    return {name: agent.schema() for name, agent in AGENT_REGISTRY.items()}


@router.post("/run", dependencies=[Depends(require_auth)])
def run_agent(body: RunRequest):
    """Routes to the correct agent and returns { output } or { error }."""
    agent = AGENT_REGISTRY.get(body.agent_type)
    if agent is None:
        raise HTTPException(
            status_code=422, detail=f"Unknown agent_type: {body.agent_type}"
        )

    try:
        output = agent.run(body.config, body.input)
        return {"output": output}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
