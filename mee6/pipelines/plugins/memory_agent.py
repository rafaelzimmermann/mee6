import asyncio
from datetime import datetime, timedelta
from typing import Any

from mee6.db.models import PipelineMemoryRow
from mee6.db.repository import PipelineMemoryRepository
from mee6.pipelines.base import AgentPlugin, FieldSchema


class MemoryAgentPlugin(AgentPlugin):
    name = "memory_agent"
    label = "Memory"
    fields: list[FieldSchema] = []

    async def get_fields(self) -> list[FieldSchema]:
        from mee6.pipelines.plugins._options import load_memory_options

        options = await load_memory_options()

        return [
            FieldSchema(
                name="read_memory",
                label="Read Memory",
                field_type="checkbox",
                required=False,
            ),
            FieldSchema(
                name="write_memory",
                label="Write Memory",
                field_type="checkbox",
                required=False,
            ),
            FieldSchema(
                name="memory_label",
                label="Memory Label",
                field_type="combobox",
                placeholder="Select or enter a memory label",
                options=options,
                required=True,
            ),
            FieldSchema(
                name="max_memories",
                label="Max Memories",
                field_type="text",
                placeholder="20",
                required=False,
            ),
            FieldSchema(
                name="ttl_hours",
                label="TTL (hours)",
                field_type="text",
                placeholder="720",
                required=False,
            ),
            FieldSchema(
                name="max_value_size",
                label="Max Value Size",
                field_type="text",
                placeholder="2000",
                required=False,
            ),
        ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        read_memory = config.get("read_memory", "") == "on"
        write_memory = config.get("write_memory", "") == "on"
        label = config.get("memory_label", "")
        max_memories = int(config.get("max_memories", "20"))
        ttl_hours = int(config.get("ttl_hours", "720"))
        max_value_size = int(config.get("max_value_size", "2000"))

        # Validate at least one checkbox is selected
        if not read_memory and not write_memory:
            return "Error: Please select at least one of Read Memory or Write Memory."

        # Write first if selected (transparent node, returns input unchanged)
        if write_memory:
            input = await self._write_memory(config, input, max_value_size)

        # Read if selected
        if read_memory:
            return await self._read_memory(config, label, ttl_hours, max_memories)

        # Only write was selected
        return input

    async def _write_memory(self, config: dict[str, str], input: str, max_value_size: int) -> str:
        """Write input to database as new memory entry and return input unchanged."""
        # Truncate input if max_value_size > 0
        if max_value_size > 0 and len(input) > max_value_size:
            input = input[:max_value_size]

        # Get dependencies
        from mee6.db.engine import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            repository = PipelineMemoryRepository(session)
            pipeline_id = config.get("_pipeline_id", "")
            label = config.get("memory_label", "")

            # Create and insert memory entry
            memory_row = PipelineMemoryRow(
                pipeline_id=pipeline_id,
                trigger_id=config.get("_trigger_id", None),
                label=label,
                created_at=datetime.utcnow(),
                value=input,
            )

            await repository.insert(memory_row)

        # Return input unchanged (transparent node)
        return input

    async def _read_memory(
        self, config: dict[str, str], label: str, ttl_hours: int, max_memories: int
    ) -> str:
        """Read memories from database and return them as a string."""
        from mee6.db.engine import AsyncSessionLocal
        from datetime import datetime, timedelta

        async with AsyncSessionLocal() as session:
            repository = PipelineMemoryRepository(session)
            pipeline_id = config.get("_pipeline_id", "")

            # Calculate cutoff time
            cutoff_time = datetime.utcnow() - timedelta(hours=ttl_hours)

            # Get memories for this label, sorted by most recent
            memories = await repository.list(
                pipeline_id=pipeline_id,
                label=label,
                created_after=cutoff_time,
                limit=max_memories,
            )

        # Format memories as a string
        if not memories:
            return f"No memories found for label '{label}' within the last {ttl_hours} hours."

        memory_strings = [f"[{m.created_at.isoformat()}] {m.value}" for m in memories]
        return f"Memories for '{label}':\n" + "\n".join(memory_strings)
