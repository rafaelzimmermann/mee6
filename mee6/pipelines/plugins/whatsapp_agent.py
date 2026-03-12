from mee6.pipelines.base import FieldSchema


class WhatsAppAgentPlugin:
    name = "whatsapp_agent"
    label = "WhatsApp Agent"
    fields = [
        FieldSchema(
            name="phone",
            label="Phone (E.164)",
            placeholder="+34612345678",
            field_type="tel",
        ),
        FieldSchema(
            name="message_template",
            label="Message",
            placeholder="Result: {previous_output}",
            field_type="textarea",
        ),
    ]

    async def run(self, config: dict[str, str], previous_output: str) -> str:
        from mee6.integrations.whatsapp import send_notification

        phone = config["phone"]
        message = config.get("message_template", "{previous_output}").format_map(
            {"previous_output": previous_output}
        )
        await send_notification(phone=phone, message=message)
        return message
