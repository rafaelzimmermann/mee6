from mee6.pipelines.base import AgentPlugin, FieldSchema


class WhatsAppAgentPlugin(AgentPlugin):
    name = "whatsapp_agent"
    label = "WhatsApp Send"
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
            placeholder="Result: {input}",
            field_type="textarea",
        ),
    ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        from mee6.integrations.whatsapp import send_notification
        from mee6.pipelines.placeholders import resolve_with_memory

        phone = config.get("phone", "")
        if not phone:
            raise ValueError("WhatsApp Send: 'phone' is required.")
        message = await resolve_with_memory(config.get("message_template", "{input}"), input=input)
        await send_notification(phone=phone, message=message)
        return f"WhatsApp message sent to {phone} Body: {message}"
