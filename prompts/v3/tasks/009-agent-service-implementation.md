# Task 009 — Agent Service Implementation

## Goal

Port the three v2 agents (LLM, Browser, Calendar) into the Python service at
`services/agents/`, wire them behind the `/schema` and `/run` FastAPI endpoints,
add Bearer token authentication on `/run`, and provide a test suite with mocked
external dependencies.

---

## Prerequisites

- Task 001 complete: `services/agents/` scaffold exists with stub `/schema` and
  `/run` endpoints, `pyproject.toml` with `fastapi`, `uvicorn`, `anthropic`,
  `pydantic`, `playwright` dependencies.

---

## Implementation steps

### 1. Project layout

```
services/agents/
├── app/
│   ├── main.py              ← FastAPI app factory, mounts router
│   ├── router.py            ← GET /schema, POST /run
│   ├── auth.py              ← Bearer token dependency
│   ├── config.py            ← pydantic-settings Config class
│   ├── schema.py            ← FieldSchema + AgentSchema types
│   └── agents/
│       ├── __init__.py
│       ├── base.py          ← BaseAgent ABC
│       ├── llm_agent.py
│       ├── browser_agent.py
│       └── calendar_agent.py
├── tests/
│   ├── conftest.py
│   ├── test_schema.py
│   ├── test_run_routing.py
│   ├── test_llm_agent.py
│   ├── test_browser_agent.py
│   └── test_calendar_agent.py
└── pyproject.toml
```

---

### 2. Configuration

**`services/agents/app/config.py`**

```python
from pydantic_settings import BaseSettings

class Config(BaseSettings):
    anthropic_api_key: str
    anthropic_model: str = "claude-opus-4-5"
    agent_service_secret: str

    class Config:
        env_file = ".env"

config = Config()
```

All three environment variables must be present at startup or the service fails
to import. `anthropic_model` has a sensible default.

---

### 3. Auth dependency

**`services/agents/app/auth.py`**

```python
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import config

bearer_scheme = HTTPBearer()

def require_auth(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)):
    if credentials.credentials != config.agent_service_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Bearer token",
        )
```

Apply this dependency only to `POST /run`. `GET /schema` is unauthenticated.

---

### 4. Schema types

**`services/agents/app/schema.py`**

```python
from typing import Any, Literal, Optional
from pydantic import BaseModel

FieldType = Literal[
    "textarea", "text", "tel", "combobox", "select",
    "group_select", "calendar_select"
]

class FieldSchema(BaseModel):
    name: str
    label: str
    field_type: FieldType
    placeholder: str = ""
    options: list[str] = []
    required: bool = True

class AgentSchema(BaseModel):
    label: str
    fields: list[FieldSchema]
```

---

### 5. Base agent

**`services/agents/app/agents/base.py`**

```python
from abc import ABC, abstractmethod

class BaseAgent(ABC):
    @abstractmethod
    def run(self, config: dict, input: str) -> str:
        """Execute agent logic. Returns output string or raises on error."""
        ...

    def schema(self) -> dict:
        """Returns the AgentSchema dict for this agent. Override in subclass."""
        raise NotImplementedError
```

---

### 6. LLM Agent

**`services/agents/app/agents/llm_agent.py`**

Port from `mee6/pipelines/plugins/llm_agent.py`.

```python
import anthropic
from app.agents.base import BaseAgent
from app.config import config
from app.schema import AgentSchema, FieldSchema

class LlmAgent(BaseAgent):
    SCHEMA = AgentSchema(
        label="LLM Agent",
        fields=[
            FieldSchema(
                name="prompt",
                label="Prompt",
                field_type="textarea",
                placeholder="Enter your prompt here. Use {input} to reference the pipeline input.",
                required=True,
            ),
            FieldSchema(
                name="system_prompt",
                label="System Prompt",
                field_type="textarea",
                placeholder="Optional system prompt",
                required=False,
            ),
        ],
    )

    def schema(self) -> dict:
        return self.SCHEMA.model_dump()

    def run(self, agent_config: dict, input: str) -> str:
        prompt = agent_config.get("prompt", "")
        system_prompt = agent_config.get("system_prompt", "")

        # Resolve {input} placeholder
        resolved_prompt = prompt.replace("{input}", input)

        client = anthropic.Anthropic(api_key=config.anthropic_api_key)

        kwargs = {
            "model": config.anthropic_model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": resolved_prompt}],
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        message = client.messages.create(**kwargs)
        return message.content[0].text
```

**Placeholder resolution rule:** every occurrence of `{input}` in `prompt` and
`system_prompt` is replaced with the literal `input` string before the API call.

---

### 7. Browser Agent

**`services/agents/app/agents/browser_agent.py`**

Port from `mee6/agents/browser_agent/agent.py`. Uses Playwright (sync API).

```python
import anthropic
from playwright.sync_api import sync_playwright
from app.agents.base import BaseAgent
from app.config import config
from app.schema import AgentSchema, FieldSchema

class BrowserAgent(BaseAgent):
    SCHEMA = AgentSchema(
        label="Browser Agent",
        fields=[
            FieldSchema(
                name="task",
                label="Task",
                field_type="textarea",
                placeholder="Describe what to do in the browser. Use {input} for dynamic input.",
                required=True,
            ),
            FieldSchema(
                name="start_url",
                label="Start URL",
                field_type="text",
                placeholder="https://example.com",
                required=False,
            ),
        ],
    )

    def schema(self) -> dict:
        return self.SCHEMA.model_dump()

    def run(self, agent_config: dict, input: str) -> str:
        task = agent_config.get("task", "").replace("{input}", input)
        start_url = agent_config.get("start_url", "")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            if start_url:
                page.goto(start_url)

            result = self._run_agentic_loop(page, task)
            browser.close()

        return result

    def _run_agentic_loop(self, page, task: str) -> str:
        """Runs the Anthropic tool-use loop with browser actions as tools.

        Tools provided:
          - navigate(url): page.goto(url)
          - click(selector): page.click(selector)
          - type_text(selector, text): page.fill(selector, text)
          - get_text(selector): page.inner_text(selector) → returns text
          - screenshot(): returns base64 PNG for vision step

        Loop terminates when the model returns a text-only response (no tool calls)
        or after 20 iterations.
        """
        # Implementation follows the same tool-use loop pattern as the Calendar
        # Agent below. Raise NotImplementedError to allow stub-first approach;
        # implement fully in this task.
        raise NotImplementedError("Browser agent tool loop must be implemented")
```

The full tool-use loop implementation must mirror the Calendar Agent pattern
(section 8 below) but with browser-action tools instead of Google Calendar tools.
The loop must cap at 20 iterations to prevent runaway execution.

---

### 8. Calendar Agent

**`services/agents/app/agents/calendar_agent.py`**

Port from `mee6/agents/calendar_agent/agent.py`.

```python
import json
import anthropic
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.agents.base import BaseAgent
from app.config import config
from app.schema import AgentSchema, FieldSchema

CALENDAR_TOOLS = [
    {
        "name": "list_events",
        "description": "List events on the calendar within a time range.",
        "input_schema": {
            "type": "object",
            "properties": {
                "time_min": {"type": "string", "description": "RFC3339 start datetime"},
                "time_max": {"type": "string", "description": "RFC3339 end datetime"},
                "max_results": {"type": "integer", "default": 10},
            },
            "required": ["time_min", "time_max"],
        },
    },
    {
        "name": "create_event",
        "description": "Create a new calendar event.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "start": {"type": "string", "description": "RFC3339 datetime"},
                "end": {"type": "string", "description": "RFC3339 datetime"},
                "description": {"type": "string"},
            },
            "required": ["summary", "start", "end"],
        },
    },
    {
        "name": "delete_event",
        "description": "Delete a calendar event by event ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {"type": "string"},
            },
            "required": ["event_id"],
        },
    },
]


class CalendarAgent(BaseAgent):
    SCHEMA = AgentSchema(
        label="Calendar Agent",
        fields=[
            FieldSchema(
                name="task",
                label="Task",
                field_type="textarea",
                placeholder="Describe what to do with the calendar. Use {input} for dynamic input.",
                required=True,
            ),
            FieldSchema(
                name="calendar_id",
                label="Calendar",
                field_type="calendar_select",
                placeholder="Select a calendar",
                required=True,
            ),
            FieldSchema(
                name="credentials_file",
                label="Credentials File Path",
                field_type="text",
                placeholder="/run/secrets/google_credentials.json",
                required=True,
            ),
        ],
    )

    def schema(self) -> dict:
        return self.SCHEMA.model_dump()

    def run(self, agent_config: dict, input: str) -> str:
        task = agent_config.get("task", "").replace("{input}", input)
        calendar_id = agent_config["calendar_id"]
        credentials_file = agent_config["credentials_file"]

        creds = Credentials.from_authorized_user_file(credentials_file)
        service = build("calendar", "v3", credentials=creds)

        return self._tool_use_loop(service, calendar_id, task)

    def _tool_use_loop(self, service, calendar_id: str, task: str) -> str:
        """Anthropic tool-use loop.

        Sends task to Claude with CALENDAR_TOOLS. Dispatches tool calls to
        _execute_tool, appends results to messages, and continues until the
        model returns a text-only response or 10 iterations are reached.
        Returns the final text response.
        """
        client = anthropic.Anthropic(api_key=config.anthropic_api_key)
        messages = [{"role": "user", "content": task}]

        for _ in range(10):
            response = client.messages.create(
                model=config.anthropic_model,
                max_tokens=4096,
                tools=CALENDAR_TOOLS,
                messages=messages,
            )

            # Accumulate assistant message
            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                # Extract text from final response
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                return ""

            # Process tool calls
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = self._execute_tool(service, calendar_id, block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result),
                    })

            if tool_results:
                messages.append({"role": "user", "content": tool_results})

        return "Max iterations reached without a final response."

    def _execute_tool(self, service, calendar_id: str, tool_name: str, tool_input: dict):
        if tool_name == "list_events":
            result = service.events().list(
                calendarId=calendar_id,
                timeMin=tool_input["time_min"],
                timeMax=tool_input["time_max"],
                maxResults=tool_input.get("max_results", 10),
                singleEvents=True,
                orderBy="startTime",
            ).execute()
            return result.get("items", [])

        elif tool_name == "create_event":
            event = {
                "summary": tool_input["summary"],
                "start": {"dateTime": tool_input["start"]},
                "end": {"dateTime": tool_input["end"]},
            }
            if "description" in tool_input:
                event["description"] = tool_input["description"]
            return service.events().insert(calendarId=calendar_id, body=event).execute()

        elif tool_name == "delete_event":
            service.events().delete(
                calendarId=calendar_id,
                eventId=tool_input["event_id"],
            ).execute()
            return {"deleted": True}

        raise ValueError(f"Unknown tool: {tool_name}")
```

#### Google Calendar credentials file

The `credentials_file` field stores a container-side path to an OAuth2
credentials JSON file (downloaded from Google Cloud Console). The file must be
mounted into the `agents` container — it must **never** be committed to the
repo.

Add a named volume mount in `docker-compose.yml`:

```yaml
agents:
  volumes:
    - ${GOOGLE_CREDENTIALS_PATH}:/run/secrets/google_credentials.json:ro
```

Add to `.env.example`:

```
# Path to Google OAuth2 credentials JSON on the host machine
GOOGLE_CREDENTIALS_PATH=/path/to/google_credentials.json
```

Users then enter `/run/secrets/google_credentials.json` as the Credentials
File Path when creating a Calendar integration step. Document this in
`services/agents/README.md`.

---

### 9. Router

**`services/agents/app/router.py`**

```python
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
    return {
        name: agent.schema()
        for name, agent in AGENT_REGISTRY.items()
    }


@router.post("/run", dependencies=[Depends(require_auth)])
def run_agent(body: RunRequest):
    """Routes to the correct agent and returns { output } or { error }."""
    agent = AGENT_REGISTRY.get(body.agent_type)
    if agent is None:
        raise HTTPException(status_code=422, detail=f"Unknown agent_type: {body.agent_type}")

    try:
        output = agent.run(body.config, body.input)
        return {"output": output}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
```

---

### 10. Main app

**`services/agents/app/main.py`**

```python
from fastapi import FastAPI
from app.router import router

app = FastAPI(title="mee6 Agent Service")
app.include_router(router)
```

---

### 11. Tests

All tests use `pytest`. Anthropic API calls must be mocked with `unittest.mock.patch`
or `pytest-mock`. The Google Calendar service and Playwright must also be mocked.

**`services/agents/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import config

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {config.agent_service_secret}"}
```

**`test_schema.py`** — key cases:
- `GET /schema` returns 200
- Response contains keys `llm_agent`, `browser_agent`, `calendar_agent`
- Each agent schema has `label` (string) and `fields` (non-empty list)
- Each field has `name`, `label`, `field_type`, `required`
- `llm_agent` has a field named `prompt` with `field_type="textarea"`
- `calendar_agent` has a field named `calendar_id` with `field_type="calendar_select"`

**`test_run_routing.py`** — key cases:
- `POST /run` without Authorization header returns 403/401
- `POST /run` with wrong token returns 401
- `POST /run` with unknown `agent_type` returns 422
- `POST /run` with `agent_type="llm_agent"` and mocked Anthropic returns `{ "output": "..." }`

**`test_llm_agent.py`** — key cases:
- `{input}` in prompt is replaced with the provided input string
- `{input}` in system_prompt is also replaced
- Anthropic `messages.create` is called once with the resolved prompt
- Response text is returned as output
- Missing `prompt` key in config does not raise (uses empty string)

**`test_browser_agent.py`** — key cases:
- `run()` with mocked Playwright does not raise
- `{input}` in task is resolved before browser interaction

**`test_calendar_agent.py`** — key cases:
- `_tool_use_loop` terminates when stop_reason is `end_turn`
- `_execute_tool("list_events", ...)` calls `service.events().list()` with correct params
- `_execute_tool("create_event", ...)` calls `service.events().insert()`
- `_execute_tool("delete_event", ...)` calls `service.events().delete()`
- Loop respects 10-iteration cap (mock always returns tool_use stop_reason)

---

## File / class list

| Path | Description |
|---|---|
| `services/agents/app/main.py` | FastAPI app factory |
| `services/agents/app/router.py` | `GET /schema`, `POST /run` endpoints |
| `services/agents/app/auth.py` | `require_auth` Bearer token dependency |
| `services/agents/app/config.py` | Pydantic-settings Config (env vars) |
| `services/agents/app/schema.py` | `FieldSchema`, `AgentSchema` Pydantic types |
| `services/agents/app/agents/base.py` | `BaseAgent` ABC |
| `services/agents/app/agents/llm_agent.py` | `LlmAgent` — Anthropic messages API with `{input}` resolution |
| `services/agents/app/agents/browser_agent.py` | `BrowserAgent` — Playwright + Anthropic tool-use loop |
| `services/agents/app/agents/calendar_agent.py` | `CalendarAgent` — Google Calendar + Anthropic tool-use loop |
| `services/agents/tests/conftest.py` | Shared fixtures: TestClient, auth headers |
| `services/agents/tests/test_schema.py` | `/schema` structure and field type assertions |
| `services/agents/tests/test_run_routing.py` | `/run` auth, routing, 422 on unknown type |
| `services/agents/tests/test_llm_agent.py` | LLM agent unit tests with mocked Anthropic |
| `services/agents/tests/test_browser_agent.py` | Browser agent unit tests with mocked Playwright |
| `services/agents/tests/test_calendar_agent.py` | Calendar agent unit tests with mocked Google API |

---

## Acceptance criteria

- [ ] `GET /schema` returns 200 with keys `llm_agent`, `browser_agent`, `calendar_agent`
- [ ] Each agent entry in `/schema` has the correct `label` and a `fields` array with at least one entry
- [ ] `llm_agent` schema includes a `prompt` field with `field_type: "textarea"`
- [ ] `calendar_agent` schema includes a `calendar_id` field with `field_type: "calendar_select"`
- [ ] `POST /run` without a valid Bearer token returns 401
- [ ] `POST /run` with `{ "agent_type": "llm_agent", "config": { "prompt": "Say hi to {input}" }, "input": "world" }` and mocked Anthropic returns `{ "output": "<mocked response>" }`
- [ ] `{input}` is replaced in the prompt before the Anthropic call (verified by mock assertion)
- [ ] `POST /run` with `agent_type: "unknown_agent"` returns 422
- [ ] `pytest services/agents/tests/` passes with zero failures (all Anthropic + Playwright + Google calls mocked)
