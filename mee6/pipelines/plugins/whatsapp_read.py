from mee6.pipelines.base import FieldSchema


class WhatsAppReadPlugin:
    name = "whatsapp_read"
    label = "WhatsApp Read"
    fields = [
        FieldSchema(
            name="phone",
            label="Read from",
            placeholder="+34612345678",
            field_type="tel",
        ),
        FieldSchema(
            name="count",
            label="Number of messages",
            placeholder="5",
            field_type="combobox",
            options=[str(i) for i in range(1, 11)],
        ),
    ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        from mee6.integrations.whatsapp import read_messages

        phone = config["phone"]
        limit = int(config.get("count", "5"))
        messages = await read_messages(phone=phone, limit=limit)

        if not messages:
            return f"No messages found from {phone}."

        lines = "\n".join(f"- {msg}" for msg in messages)
        return f"Last {len(messages)} message(s) from {phone}:\n{lines}"
