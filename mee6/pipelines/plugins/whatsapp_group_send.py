import logging

from mee6.pipelines.base import FieldSchema

logger = logging.getLogger(__name__)


class WhatsAppGroupSendPlugin:
    name = "whatsapp_group_send"
    label = "WhatsApp Group Send"

    fields: list[FieldSchema] = []

    async def get_fields(self) -> list[FieldSchema]:
        from mee6.pipelines.plugins._options import load_group_options

        options = await load_group_options()

        return [
            FieldSchema(
                name="group",
                label="Group",
                field_type="group_select",
                placeholder="Select a group",
                options=options,
                required=True,
            ),
            FieldSchema(
                name="message_template",
                label="Message",
                placeholder="Result: {input}",
                field_type="textarea",
                required=True,
            ),
        ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        from mee6.integrations.whatsapp import send_group_message
        from mee6.pipelines.placeholders import resolve_with_memory

        group_jid = config.get("group", "")
        message = await resolve_with_memory(config.get("message_template", "{input}"), input=input)

        await send_group_message(group_jid=group_jid, message=message)
        return f"WhatsApp group message sent to {group_jid}. Body: {message}"
