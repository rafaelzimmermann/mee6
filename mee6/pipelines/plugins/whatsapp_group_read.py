import logging

from mee6.pipelines.base import FieldSchema

logger = logging.getLogger(__name__)


class WhatsAppGroupReadPlugin:
    name = "whatsapp_group_read"
    label = "WhatsApp Group Read"

    fields: list[FieldSchema] = []

    async def get_fields(self) -> list[FieldSchema]:
        """Return fields with group options loaded from the database."""
        from mee6.db.engine import AsyncSessionLocal
        from mee6.db.repository import WhatsAppGroupRepository

        async with AsyncSessionLocal() as session:
            groups = await WhatsAppGroupRepository(session).list_all()

        # Encode as "name||jid" — stored value is the JID (robust, names can change)
        options = [f"{g.name}||{g.jid}" for g in groups]

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
                name="count",
                label="Number of messages",
                placeholder="5",
                field_type="combobox",
                required=False,
                options=[str(i) for i in range(1, 21)],
            ),
        ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        from mee6.integrations.whatsapp import read_group_messages

        group_jid = config.get("group", "")
        limit = int(config.get("count", "5") or "5")

        if not group_jid:
            return "No group configured."

        messages = await read_group_messages(group_jid=group_jid, limit=limit)

        if not messages:
            return f"No messages found in group {group_jid}."

        lines = "\n".join(f"- {msg}" for msg in messages)
        return f"Last {len(messages)} message(s) from group {group_jid}:\n{lines}"
