"""Google Calendar API stub."""

from google.oauth2.service_account import Credentials  # type: ignore[import-untyped]
from googleapiclient.discovery import build  # type: ignore[import-untyped]

from mee6.config import settings

_SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _get_service():
    creds = Credentials.from_service_account_file(settings.google_credentials_file, scopes=_SCOPES)
    return build("calendar", "v3", credentials=creds)


async def create_calendar_event(*, title: str, date: str, time: str, description: str) -> None:
    """Insert an all-day or timed event into the configured Google Calendar."""
    service = _get_service()

    if time:
        start = {"dateTime": f"{date}T{time}:00", "timeZone": "UTC"}
        end = {"dateTime": f"{date}T{time}:00", "timeZone": "UTC"}
    else:
        start = {"date": date}
        end = {"date": date}

    event = {
        "summary": title,
        "description": description,
        "start": start,
        "end": end,
    }

    service.events().insert(calendarId=settings.google_calendar_id, body=event).execute()
