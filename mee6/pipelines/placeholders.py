"""Placeholder resolution for pipeline step configs and prompts."""

from datetime import datetime, timezone
import re
from typing import Callable

# Displayed in UI next to textarea fields.
AVAILABLE = ["{input}", "{date}", "{now}", "{memory:label}"]


async def get_memories_for_label(label: str) -> str:
    """Fetch all memories for a given label and return formatted output."""
    from mee6.db.engine import AsyncSessionLocal
    from mee6.db.repository import MemoryRepository

    async with AsyncSessionLocal() as session:
        repo = MemoryRepository(session)
        entries = await repo.get_entries_by_label(label)

        if not entries:
            return f"[Memory: {label}]\nNo memories found"

        lines = [f"[Memory: {label}]"]
        for i, entry in enumerate(entries, 1):
            created_at = entry.created_at.strftime("%Y-%m-%d")
            lines.append(f"[{i}] {created_at} — {entry.value}")

        return "\n".join(lines)


def resolve(text: str, *, input: str = "") -> str:
    """Expand placeholders in *text*.

    {input}            — output of previous pipeline step
    {previous_output}  — alias for {input} (backward compatibility)
    {date}             — today's date as YYYY-MM-DD (UTC)
    {now}              — current UTC timestamp as ISO 8601
    {memory:label}     — all memories for given label (async replacement needed)
    """
    now = datetime.now(timezone.utc)

    # Escape {memory:...} so format_map treats them as literals.
    # resolve_with_memory() will expand them asynchronously afterward.
    safe = re.sub(r'\{(memory:[^}]+)\}', r'{{\1}}', text)

    return safe.format_map(
        {
            "input": input,
            "previous_output": input,  # backward compat
            "date": now.strftime("%Y-%m-%d"),
            "now": now.isoformat(timespec="seconds"),
        }
    )


async def resolve_with_memory(text: str, *, input: str = "") -> str:
    """Expand placeholders in *text*, including async {memory:label} resolution."""
    result = resolve(text, input=input)

    pattern = r'\{memory:([^}]+)\}'
    matches = list(re.finditer(pattern, result))

    for match in matches:
        label = match.group(1)
        replacement = await get_memories_for_label(label)
        result = result.replace(match.group(0), replacement)

    return result
