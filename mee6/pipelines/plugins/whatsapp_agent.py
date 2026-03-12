from mee6.pipelines.base import FieldSchema


class WhatsAppAgentPlugin:
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
        from mee6.pipelines.placeholders import resolve

        phone = config["phone"]
        message = resolve(config.get("message_template", "{input}"), input=input)
        await send_notification(phone=phone, message=message)
        return f"WhatsApp message sent to {phone} Body: {message}"
