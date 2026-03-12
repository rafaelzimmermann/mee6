import logging

from mee6.pipelines.base import FieldSchema

logger = logging.getLogger(__name__)


class CalendarAgentPlugin:
    name = "calendar_agent"
    label = "Calendar Agent"

    # Static fallback (empty until get_fields() is called)
    fields: list[FieldSchema] = []

    async def get_fields(self) -> list[FieldSchema]:
        """Return fields with calendar options loaded from the database."""
        from mee6.pipelines.plugins._options import load_calendar_options

        options = await load_calendar_options()

        return [
            FieldSchema(
                name="calendar",
                label="Target Calendar",
                field_type="calendar_select",
                placeholder="Select a calendar",
                options=options,
                required=True,
            ),
            FieldSchema(
                name="prompt",
                label="Instructions",
                field_type="textarea",
                placeholder=(
                    "Today is {date}. Extract events from {input}, "
                    "create them if they aren't already present."
                ),
                required=True,
            ),
        ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        from mee6.agents.calendar_agent.agent import run_calendar_agent
        from mee6.db.engine import AsyncSessionLocal
        from mee6.db.repository import CalendarRepository
        from mee6.pipelines.placeholders import resolve

        calendar_label = config.get("calendar", "")
        prompt = resolve(config.get("prompt", ""), input=input)

        async with AsyncSessionLocal() as session:
            cal = await CalendarRepository(session).get_by_label(calendar_label)

        if cal is None:
            raise ValueError(
                f"Calendar '{calendar_label}' not found. "
                "Please configure it in Integrations → Google Calendar."
            )

        return await run_calendar_agent(
            calendar_id=cal.calendar_id,
            credentials_file=cal.credentials_file,
            prompt=prompt,
        )
