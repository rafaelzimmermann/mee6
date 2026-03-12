"""Placeholder resolution for pipeline step configs and prompts."""

from datetime import datetime, timezone

# Displayed in the UI next to textarea fields.
AVAILABLE = ["{input}", "{date}", "{now}"]


def resolve(text: str, *, input: str = "") -> str:
    """Expand placeholders in *text*.

    {input}            — output of the previous pipeline step
    {previous_output}  — alias for {input} (backward compatibility)
    {date}             — today's date as YYYY-MM-DD (UTC)
    {now}              — current UTC timestamp as ISO 8601
    """
    now = datetime.now(timezone.utc)
    return text.format_map(
        {
            "input": input,
            "previous_output": input,  # backward compat
            "date": now.strftime("%Y-%m-%d"),
            "now": now.isoformat(timespec="seconds"),
        }
    )
