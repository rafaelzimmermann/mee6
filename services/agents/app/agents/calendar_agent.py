import json
import anthropic
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.agents.base import BaseAgent
from app.config import config as app_config
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

    def run(self, config: dict, input: str) -> str:
        task = config.get("task", "").replace("{input}", input)
        calendar_id = config["calendar_id"]
        credentials_file = config["credentials_file"]

        creds = Credentials.from_authorized_user_file(credentials_file)
        service = build("calendar", "v3", credentials=creds)

        return self._tool_use_loop(service, calendar_id, task)

    def _tool_use_loop(self, service, calendar_id: str, task: str) -> str:
        """Anthropic tool-use loop."""
        client = anthropic.Anthropic(api_key=app_config.anthropic_api_key)
        messages = [{"role": "user", "content": task}]

        for _ in range(10):
            response = client.messages.create(
                model=app_config.anthropic_model,
                max_tokens=4096,
                tools=CALENDAR_TOOLS,
                messages=messages,
            )

            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                return ""

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = self._execute_tool(
                        service, calendar_id, block.name, block.input
                    )
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result),
                        }
                    )

            if tool_results:
                messages.append({"role": "user", "content": tool_results})

        return "Max iterations reached without a final response."

    def _execute_tool(
        self, service, calendar_id: str, tool_name: str, tool_input: dict
    ):
        if tool_name == "list_events":
            result = (
                service.events()
                .list(
                    calendarId=calendar_id,
                    timeMin=tool_input["time_min"],
                    timeMax=tool_input["time_max"],
                    maxResults=tool_input.get("max_results", 10),
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
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
