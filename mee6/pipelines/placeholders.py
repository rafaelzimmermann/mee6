"""Placeholder resolution for pipeline step configs and prompts."""

from datetime import datetime, timezone
import re
from typing import Callable

# Displayed in UI next to textarea fields.
AVAILABLE = ["{input}", "{date}", "{now}", "{memory:label}"]


async def get_memories_for_label(label: str) -> str:
    """Fetch all memories for a given label and return formatted output."""
    from mee6.db.engine import AsyncSessionLocal
    from mee6.db.repository import PipelineMemoryRepository
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        repository = PipelineMemoryRepository(session)
        result = await session.execute(
            select(PipelineMemoryRow).where(
                PipelineMemoryRow.label == label
            ).order_by(PipelineMemoryRow.created_at.asc())
        )
        memories = result.scalars().all()

        if not memories:
            return f"[Memory: {label}]\nNo memories found"

        # Format memories
        lines = [f"[Memory: {label}]"]
        for i, memory in enumerate(memories, 1):
            created_at = memory.created_at.strftime("%Y-%m-%d")
            lines.append(f"[{i}] {created_at} — {memory.value}")

        return "\n".join(lines)


def resolve(text: str, *, input: str = "") -> str:
    """Expand placeholders in *text*.

    {input}            — output of previous pipeline step
    {previous_output}  — alias for {input} (backward compatibility)
    {date}             — today's date as YYYY-MM-DD (UTC)
    {now}              — current UTC timestamp as ISO 8601
    {memory:label}       — all memories for given label (async replacement needed)
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


async def resolve_with_memory(text: str, *, input: str = "") -> str:
    """Expand placeholders in *text*, including async {memory:label} resolution.

    This is the async version of resolve() that handles memory placeholders.
    """
    # First resolve standard placeholders
    result = resolve(text, input=input)

    # Find and replace {memory:label} placeholders
    pattern = r'\{memory:([^}]+)\}'
    matches = list(re.finditer(pattern, result))

    for match in matches:
        label = match.group(1)
        replacement = await get_memories_for_label(label)
        # Replace the placeholder with memories
        result = result.replace(match.group(0), replacement)

    return result
