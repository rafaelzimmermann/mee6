"""Google Calendar API wrapper."""

import logging

from google.oauth2.service_account import Credentials  # type: ignore[import-untyped]
from googleapiclient.discovery import build  # type: ignore[import-untyped]
from googleapiclient.errors import HttpError  # type: ignore[import-untyped]

logging.getLogger("googleapiclient.discovery_cache").setLevel(logging.ERROR)

logger = logging.getLogger(__name__)


def _attendees_to_description_note(attendees: list[str], existing_description: str) -> str:
    """Append a guest list to the description when API-level invites are unavailable."""
    note = "Guests: " + ", ".join(attendees)
    return f"{existing_description}\n\n{note}".strip() if existing_description else note

_SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _get_service(credentials_file: str):
    creds = Credentials.from_service_account_file(credentials_file, scopes=_SCOPES)
    return build("calendar", "v3", credentials=creds)


def _dt_field(val: str) -> dict:
    """Return a Calendar API start/end dict for a date or dateTime string."""
    if "T" in val:
        return {"dateTime": val, "timeZone": "UTC"}
    return {"date": val}


def list_events(
    calendar_id: str, credentials_file: str, time_min: str, time_max: str
) -> list[dict]:
    """Return events in [time_min, time_max] (RFC3339 strings), ordered by start."""
    service = _get_service(credentials_file)
    result = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    return result.get("items", [])


def create_event(
    calendar_id: str,
    credentials_file: str,
    *,
    title: str,
    start: str,
    end: str,
    description: str = "",
    attendees: list[str] | None = None,
) -> dict:
    """Insert a new event. start/end are 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS'."""
    service = _get_service(credentials_file)
    event: dict = {
        "summary": title,
        "description": description,
        "start": _dt_field(start),
        "end": _dt_field(end),
    }
    if attendees:
        event["attendees"] = [{"email": e} for e in attendees]
    try:
        return service.events().insert(calendarId=calendar_id, body=event).execute()
    except HttpError as exc:
        if exc.status_code == 403 and b"forbiddenForServiceAccounts" in exc.content:
            logger.warning("Service account cannot invite attendees; falling back to description note.")
            event.pop("attendees", None)
            event["description"] = _attendees_to_description_note(attendees or [], description)
            return service.events().insert(calendarId=calendar_id, body=event).execute()
        raise


def update_event(
    calendar_id: str,
    credentials_file: str,
    event_id: str,
    *,
    title: str,
    start: str,
    end: str,
    description: str = "",
    attendees: list[str] | None = None,
) -> dict:
    """Replace an existing event's fields."""
    service = _get_service(credentials_file)
    event: dict = {
        "summary": title,
        "description": description,
        "start": _dt_field(start),
        "end": _dt_field(end),
    }
    if attendees:
        event["attendees"] = [{"email": e} for e in attendees]
    try:
        return (
            service.events()
            .update(calendarId=calendar_id, eventId=event_id, body=event)
            .execute()
        )
    except HttpError as exc:
        if exc.status_code == 403 and b"forbiddenForServiceAccounts" in exc.content:
            logger.warning("Service account cannot invite attendees; falling back to description note.")
            event.pop("attendees", None)
            event["description"] = _attendees_to_description_note(attendees or [], description)
            return (
                service.events()
                .update(calendarId=calendar_id, eventId=event_id, body=event)
                .execute()
            )
        raise


def delete_event(calendar_id: str, credentials_file: str, event_id: str) -> None:
    """Delete an event by its ID."""
    service = _get_service(credentials_file)
    service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
