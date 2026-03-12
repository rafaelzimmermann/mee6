"""Calendar sync agent using Anthropic tool_use.

The agent is given a user prompt (which may reference {previous_output}) and
access to four Google Calendar tools.  It decides which events to create,
update, or delete, executes those operations, and returns a structured summary.
"""

import asyncio
import json
import logging
from typing import Any

from mee6.config import settings
from mee6.integrations import calendar as cal_lib

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are a calendar sync assistant with access to tools that read and write "
    "Google Calendar events. Use them to fulfil the user's request. After all "
    "operations are complete, reply with a structured summary using exactly these "
    "sections:\n\n"
    "## Events Created\n- list each event (title, date/time, description)\n\n"
    "## Events Updated\n- list each change and the reason\n\n"
    "## Events Removed\n- list each event and the reason\n\n"
    "Write 'None.' under any section that had no activity."
)

_TOOLS = [
    {
        "name": "list_events",
        "description": "List calendar events in a time range.",
        "input_schema": {
            "type": "object",
            "properties": {
                "time_min": {
                    "type": "string",
                    "description": "Start of range, RFC3339, e.g. 2024-01-01T00:00:00Z",
                },
                "time_max": {
                    "type": "string",
                    "description": "End of range, RFC3339, e.g. 2024-12-31T23:59:59Z",
                },
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
                "title": {"type": "string"},
                "start": {
                    "type": "string",
                    "description": "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS",
                },
                "end": {
                    "type": "string",
                    "description": "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS (use same as start for all-day)",
                },
                "description": {"type": "string"},
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of guest email addresses to invite.",
                },
            },
            "required": ["title", "start", "end"],
        },
    },
    {
        "name": "update_event",
        "description": "Update an existing calendar event by its ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {"type": "string"},
                "title": {"type": "string"},
                "start": {"type": "string"},
                "end": {"type": "string"},
                "description": {"type": "string"},
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of guest email addresses. Replaces the existing guest list.",
                },
            },
            "required": ["event_id", "title", "start", "end"],
        },
    },
    {
        "name": "delete_event",
        "description": "Delete a calendar event by its ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {"type": "string"},
            },
            "required": ["event_id"],
        },
    },
]


async def run_calendar_agent(
    *,
    calendar_id: str,
    credentials_file: str,
    prompt: str,
) -> str:
    """Run the calendar sync agent and return a human-readable summary.

    *prompt* should already have placeholders resolved by the caller.
    """
    import anthropic

    user_content = prompt

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    messages: list[dict] = [{"role": "user", "content": user_content}]

    logger.info("calendar_agent: calendar_id=%s credentials=%s", calendar_id, credentials_file)

    while True:
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=4096,
            system=_SYSTEM,
            tools=_TOOLS,
            messages=messages,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            for block in response.content:
                if hasattr(block, "text"):
                    return block.text
            return "Calendar operations completed."

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            result = await _handle_tool(block.name, block.input, calendar_id, credentials_file)
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                }
            )

        messages.append({"role": "user", "content": tool_results})


async def _handle_tool(
    name: str, inp: dict, calendar_id: str, credentials_file: str
) -> Any:
    logger.info("calendar_agent tool=%s input=%s", name, inp)

    if name == "list_events":
        events = await asyncio.to_thread(
            cal_lib.list_events,
            calendar_id,
            credentials_file,
            inp["time_min"],
            inp["time_max"],
        )
        return [
            {
                "id": e["id"],
                "title": e.get("summary", ""),
                "start": (
                    e.get("start", {}).get("dateTime")
                    or e.get("start", {}).get("date", "")
                ),
                "end": (
                    e.get("end", {}).get("dateTime")
                    or e.get("end", {}).get("date", "")
                ),
                "description": e.get("description", ""),
                "attendees": [a["email"] for a in e.get("attendees", [])],
            }
            for e in events
        ]

    if name == "create_event":
        event = await asyncio.to_thread(
            cal_lib.create_event,
            calendar_id,
            credentials_file,
            title=inp["title"],
            start=inp["start"],
            end=inp["end"],
            description=inp.get("description", ""),
            attendees=inp.get("attendees", []),
        )
        return {"id": event["id"], "status": "created"}

    if name == "update_event":
        event = await asyncio.to_thread(
            cal_lib.update_event,
            calendar_id,
            credentials_file,
            inp["event_id"],
            title=inp["title"],
            start=inp["start"],
            end=inp["end"],
            description=inp.get("description", ""),
            attendees=inp.get("attendees", []),
        )
        return {"id": event["id"], "status": "updated"}

    if name == "delete_event":
        await asyncio.to_thread(
            cal_lib.delete_event,
            calendar_id,
            credentials_file,
            inp["event_id"],
        )
        return {"status": "deleted"}

    return {"error": f"Unknown tool: {name}"}
