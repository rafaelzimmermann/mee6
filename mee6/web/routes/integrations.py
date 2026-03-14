from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from mee6.db.engine import AsyncSessionLocal
from mee6.db.models import CalendarRow, WhatsAppGroupRow
from mee6.db.repository import (
    CalendarRepository,
    WhatsAppGroupRepository,
    WhatsAppSettingsRepository,
)
from mee6.integrations.whatsapp_session import wa_session
from mee6.web.templates_env import templates

router = APIRouter(prefix="/integrations")


async def _wa_ctx() -> dict:
    async with AsyncSessionLocal() as session:
        phone = await WhatsAppSettingsRepository(session).get_phone_number()
    return {
        "wa_status": wa_session.status.value,
        "wa_qr_svg": wa_session.get_qr_svg(),
        "wa_error": wa_session.error,
        "notify_phone": phone,
    }


async def _wa_groups() -> list[WhatsAppGroupRow]:
    async with AsyncSessionLocal() as session:
        return await WhatsAppGroupRepository(session).list_all()


async def _calendars() -> list[CalendarRow]:
    async with AsyncSessionLocal() as session:
        return await CalendarRepository(session).list_all()


@router.get("", response_class=HTMLResponse)
async def integrations_page(request: Request):
    return templates.TemplateResponse(
        request,
        "integrations.html",
        {
            "active_count": 0,
            **await _wa_ctx(),
            "wa_groups": await _wa_groups(),
            "calendars": await _calendars(),
        },
    )


@router.get("/memories", response_class=HTMLResponse)
async def list_memories(request: Request):
    from mee6.db.models import MemoryEntryRow
    from mee6.db.repository import MemoryRepository

    async with AsyncSessionLocal() as session:
        repo = MemoryRepository(session)
        configs = await repo.list_configs()
        memory_configs = []
        for cfg in configs:
            count = await repo.count_entries(cfg.id)
            memory_configs.append(
                {
                    "label": cfg.label,
                    "max_memories": cfg.max_memories,
                    "ttl_hours": cfg.ttl_hours,
                    "max_value_size": cfg.max_value_size,
                    "count": count,
                }
            )
    return templates.TemplateResponse(
        request, "memories.html", {"memory_configs": memory_configs, "active_count": 0}
    )
