"""Orchestrates the school-monitor flow."""

import json
import logging

from mee6.agents.school_monitor.agent import SchoolMonitorAgent
from mee6.config import settings
from mee6.integrations.calendar import create_calendar_event
from mee6.integrations.whatsapp import send_notification

logger = logging.getLogger(__name__)


async def run_school_monitor() -> dict:
    """Run the school-monitor agent and process each extracted event.

    Returns a result summary dict used by the dashboard.
    """
    agent = SchoolMonitorAgent()
    raw_output = await agent.run("Fetch school events and process them.")

    try:
        events = json.loads(raw_output)
        if not isinstance(events, list):
            raise ValueError("Expected a JSON array of events")
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("school-monitor: failed to parse agent output: %s", exc)
        return {"summary": f"Parse error: {exc}", "events_processed": 0}

    processed = 0
    errors = 0
    for event in events:
        try:
            await create_calendar_event(
                title=event["title"],
                date=event["date"],
                time=event.get("time", ""),
                description=event.get("description", ""),
            )
            message = (
                f"School event: {event['title']}\n"
                f"Date: {event['date']} {event.get('time', '')}\n"
                f"{event.get('description', '')}"
            ).strip()
            await send_notification(phone=settings.notify_phone_number, message=message)
            processed += 1
        except Exception as exc:
            logger.error("school-monitor: error processing event %s: %s", event.get("title"), exc)
            errors += 1

    return {
        "summary": f"{processed} event(s) processed, {errors} error(s)",
        "events_processed": processed,
        "errors": errors,
    }
