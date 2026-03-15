from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Agents Service", version="0.1.0")


class RunRequest(BaseModel):
    agent_type: str
    input: dict


class RunResponse(BaseModel):
    output: str


@app.get("/schema")
def get_schema():
    return {
        "llm_agent": {
            "label": "LLM Agent",
            "fields": [
                {"name": "prompt", "type": "string", "required": True},
                {"name": "model", "type": "string", "default": "claude-opus-4-5"},
            ],
        },
        "browser_agent": {
            "label": "Browser Agent",
            "fields": [
                {"name": "url", "type": "string", "required": True},
                {"name": "action", "type": "string", "required": True},
            ],
        },
        "calendar_agent": {
            "label": "Calendar Agent",
            "fields": [
                {"name": "event_title", "type": "string", "required": True},
                {"name": "start_time", "type": "string", "required": True},
                {"name": "end_time", "type": "string", "required": True},
            ],
        },
    }


@app.post("/run", response_model=RunResponse)
def run_agent(request: RunRequest):
    return {"output": "stub"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
