from mee6.pipelines.base import AgentPlugin, FieldSchema


def _format_messages(rows: list) -> str:
    """Format WhatsAppMessageRow objects as an indexed, timestamped list."""
    if not rows:
        return ""
    parts = []
    for i, row in enumerate(rows, start=1):
        ts = row.timestamp.strftime("%Y-%m-%d %H:%M")
        parts.append(f"[{i}] [{ts}] - {row.sender} \n{row.text}\n[/{i}]")
    return "\n\n".join(parts)


class WhatsAppReadPlugin(AgentPlugin):
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

        phone = config.get("phone", "")
        if not phone:
            raise ValueError("WhatsApp Read: 'phone' is required.")
        limit = int(config.get("count", "5"))
        messages = await read_messages(phone=phone, limit=limit)

        if not messages:
            return f"No messages found from {phone}."

        return _format_messages(messages)
