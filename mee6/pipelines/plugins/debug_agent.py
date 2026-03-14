import logging
from mee6.pipelines.base import AgentPlugin, FieldSchema

logger = logging.getLogger(__name__)


class DebugAgentPlugin(AgentPlugin):
    name = "debug_agent"
    label = "Debug"
    fields = [
        FieldSchema(
            name="message_template",
            label="Message",
            placeholder="debug: {input}",
            field_type="textarea",
            required=False,
        ),
    ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        from mee6.pipelines.placeholders import resolve_with_memory

        message = await resolve_with_memory(config.get("message_template", "{input}"), input=input)
        logger.info("DebugAgent: %s", message)
        return input  # passthrough — next step receives unmodified input
