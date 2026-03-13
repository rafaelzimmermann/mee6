from datetime import datetime, timezone

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
                name="memory_label",
                label="Memory Label",
                field_type="select",
                placeholder="Select a memory label",
                options=options,
                required=True,
            ),
        ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        """Write input to the named memory label and pass it through unchanged."""
        label = config.get("memory_label", "").strip()
        if not label:
            raise ValueError("Memory step: no memory_label configured")

        from mee6.db.engine import AsyncSessionLocal
        from mee6.db.models import MemoryEntryRow
        from mee6.db.repository import MemoryRepository

        async with AsyncSessionLocal() as session:
            repo = MemoryRepository(session)
            mem_config = await repo.get_config(label)
            if mem_config is None:
                raise ValueError(
                    f"Memory label '{label}' is not configured. "
                    "Create it in Integrations → Memories first."
                )

            value = input
            if mem_config.max_value_size > 0 and len(value) > mem_config.max_value_size:
                value = value[:mem_config.max_value_size]

            await repo.insert_entry(
                MemoryEntryRow(
                    memory_id=mem_config.id,
                    created_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    value=value,
                )
            )
            await repo.delete_oldest_entries(
                memory_id=mem_config.id,
                keep=mem_config.max_memories,
            )

        return input  # transparent pass-through
