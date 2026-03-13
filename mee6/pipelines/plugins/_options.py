"""Shared DB-option loaders for plugin get_fields() implementations."""


async def load_group_options() -> list[str]:
    """Return WhatsApp groups encoded as 'name||jid' strings for group_select fields."""
    from mee6.db.engine import AsyncSessionLocal
    from mee6.db.repository import WhatsAppGroupRepository

    async with AsyncSessionLocal() as session:
        groups = await WhatsAppGroupRepository(session).list_all()
    return [f"{g.name}||{g.jid}" for g in groups]


async def load_calendar_options() -> list[str]:
    """Return calendars encoded as 'label||calendar_id' strings for calendar_select fields."""
    from mee6.db.engine import AsyncSessionLocal
    from mee6.db.repository import CalendarRepository

    async with AsyncSessionLocal() as session:
        calendars = await CalendarRepository(session).list_all()
    return [f"{c.label}||{c.calendar_id}" for c in calendars]


async def load_memory_options() -> list[str]:
    """Return available memory labels for combobox fields."""
    from mee6.db.engine import AsyncSessionLocal
    from mee6.db.models import PipelineMemoryRow
    from sqlalchemy import distinct, select

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(distinct(PipelineMemoryRow.label))
            .order_by(PipelineMemoryRow.label)
        )
        labels = [row[0] for row in result.fetchall()]
    return labels
