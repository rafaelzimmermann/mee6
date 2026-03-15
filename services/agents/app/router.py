from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_auth
from app.agents.llm_agent import LlmAgent
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
