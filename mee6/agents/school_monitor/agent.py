from typing import Any, Sequence

from agntrick import AgentBase, AgentRegistry
from langchain_core.tools import StructuredTool
from pydantic import BaseModel

from mee6.agents.school_monitor.prompts import SYSTEM_PROMPT
from mee6.integrations.calendar import create_calendar_event as _create_cal_event
from mee6.integrations.school_app import fetch_school_content
from mee6.integrations.whatsapp import send_notification


class _FetchSchoolAppInput(BaseModel):
    pass  # no args needed; credentials come from config


class _CreateCalendarEventInput(BaseModel):
    title: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    description: str


class _SendWhatsAppNotificationInput(BaseModel):
    phone: str
    message: str


@AgentRegistry.register("school-monitor")
class SchoolMonitorAgent(AgentBase):
    @property
    def system_prompt(self) -> str:
        return SYSTEM_PROMPT

    def local_tools(self) -> Sequence[Any]:
        return [
            StructuredTool.from_function(
                coroutine=_tool_fetch_school_app,
                name="fetch_school_app",
                description="Fetch the latest content from the school app.",
                args_schema=_FetchSchoolAppInput,
            ),
            StructuredTool.from_function(
                coroutine=_tool_create_calendar_event,
                name="create_calendar_event",
                description="Create a Google Calendar event for a school activity.",
                args_schema=_CreateCalendarEventInput,
            ),
            StructuredTool.from_function(
                coroutine=_tool_send_whatsapp_notification,
                name="send_whatsapp_notification",
                description="Send a WhatsApp notification to the parent's phone.",
                args_schema=_SendWhatsAppNotificationInput,
            ),
        ]


async def _tool_fetch_school_app() -> str:
    return await fetch_school_content()


async def _tool_create_calendar_event(title: str, date: str, time: str, description: str) -> str:
    await _create_cal_event(title=title, date=date, time=time, description=description)
    return f"Calendar event '{title}' created for {date} at {time}."


async def _tool_send_whatsapp_notification(phone: str, message: str) -> str:
    await send_notification(phone=phone, message=message)
    return f"Notification sent to {phone}."
