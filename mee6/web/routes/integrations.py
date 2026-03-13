import logging
import urllib.parse
import uuid

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from mee6.config import settings
from mee6.db.engine import AsyncSessionLocal
from mee6.db.models import CalendarRow, PipelineMemoryRow, WhatsAppGroupRow
from mee6.db.repository import (
    CalendarRepository,
    PipelineMemoryRepository,
    WhatsAppGroupRepository,
    WhatsAppSettingsRepository,
)
from mee6.integrations.whatsapp_session import wa_session
from mee6.scheduler.engine import scheduler
from sqlalchemy import delete, distinct, func, select
from mee6.web.templates_env import templates

logger = logging.getLogger(__name__)

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
            "ctx": await _wa_ctx(),
            "wa_groups": await _wa_groups(),
            "calendars": await _calendars(),
        },
    )


@router.post("/whatsapp/status")
async def toggle_whatsapp(request: Request):
    enabled = (await request.form()).get("enabled", "off") == "on"
    wa_session.set_enabled(enabled)
    return RedirectResponse("/integrations", status_code=303)


@router.post("/whatsapp/phone")
async def set_whatsapp_phone(phone: str = Form(...)):
    async with AsyncSessionLocal() as session:
        await WhatsAppSettingsRepository(session).set_phone_number(phone.strip())
    return RedirectResponse("/integrations", status_code=303)


@router.post("/whatsapp/sync")
async def sync_whatsapp_groups(request: Request):
    try:
        updated = await wa_session.sync_groups()
        msg = urllib.parse.quote(f"Synced {updated} groups.")
    except Exception as e:
        logger.error("WhatsApp sync failed: %s", e)
        msg = urllib.parse.quote("Sync failed.")
    return RedirectResponse(f"/integrations?info={msg}", status_code=303)


@router.post("/whatsapp/groups/{jid}/label")
async def update_whatsapp_group_label(jid: str, label: str = Form(...)):
    async with AsyncSessionLocal() as session:
        await WhatsAppGroupRepository(session).update_label(jid.strip(), label.strip())
    return RedirectResponse("/integrations", status_code=303)


@router.get("/calendars", response_class=HTMLResponse)
async def list_calendars(request: Request):
    async with AsyncSessionLocal() as session:
        calendars = await CalendarRepository(session).list_all()
    return templates.TemplateResponse(
        request, "calendars.html", {"calendars": calendars, "active_count": 0}
    )


@router.post("/calendars")
async def create_calendar(
    label: str = Form(...),
    calendar_id: str = Form(...),
):
    row = CalendarRow(
        id=str(uuid.uuid4()),
        label=label.strip(),
        calendar_id=calendar_id.strip(),
        credentials_file=settings.google_credentials_file,
    )
    async with AsyncSessionLocal() as session:
        await CalendarRepository(session).upsert(row)
    return RedirectResponse("/integrations", status_code=303)


@router.post("/calendars/{cal_id}/delete")
async def delete_calendar(cal_id: str):
    async with AsyncSessionLocal() as session:
        await CalendarRepository(session).delete(cal_id)
    return RedirectResponse("/integrations", status_code=303)


# Memory Integration Routes
@router.get("/memories/api")
async def get_memory_labels():
    """API endpoint to get available memory labels for pipeline editor."""
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import distinct, select

            result = await session.execute(
                select(distinct(PipelineMemoryRow.label)).order_by(PipelineMemoryRow.label)
            )
            memory_labels = [row[0] for row in result.fetchall()]

            logger.info(f"Found {len(memory_labels)} memory labels: {memory_labels}")
            return memory_labels
    except Exception as e:
        logger.error(f"Error fetching memory labels: {e}")
        return []


@router.get("/memories/debug")
async def debug_memory():
    """Debug endpoint to check memory table and labels."""
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select, func

            # Check if table exists and has data
            count_result = await session.execute(select(func.count(PipelineMemoryRow.id)))
            total_count = count_result.scalar_one()

            # Get sample labels
            sample_result = await session.execute(select(PipelineMemoryRow.label).limit(5))
            sample_labels = [row[0] for row in sample_result.fetchall()]

            return {
                "total_memory_entries": total_count,
                "sample_labels": sample_labels,
                "status": "ok",
            }
    except Exception as e:
        logger.error(f"Debug error: {e}")
        return {"total_memory_entries": 0, "sample_labels": [], "status": f"error: {str(e)}"}


@router.get("/memories/new", response_class=HTMLResponse)
async def new_memory_form(request: Request):
    """Form to create a new memory configuration."""
    return templates.TemplateResponse(request, "new_memory.html", {"active_count": 0})


@router.get("/memories", response_class=HTMLResponse)
async def list_memories(request: Request):
    async with AsyncSessionLocal() as session:
        repository = PipelineMemoryRepository(session)

        # Get all memory configurations
        configs = await repository.list_configs()

        # Get memory counts for each label
        for config in configs:
            count_result = await session.execute(
                select(func.count(PipelineMemoryRow.id)).where(PipelineMemoryRow.label == config["label"])
            )
            config["count"] = count_result.scalar_one()

    return templates.TemplateResponse(
        request, "memories.html", {"memory_configs": configs, "active_count": 0}
    )


@router.post("/memories")
async def create_memory(
    label: str = Form(...),
    max_memories: str = Form("20"),
    ttl_hours: str = Form("720"),
    max_value_size: str = Form("2000"),
):
    async with AsyncSessionLocal() as session:
        repository = PipelineMemoryRepository(session)
        await repository.set_config(
            label=label.strip(),
            max_memories=int(max_memories),
            ttl_hours=int(ttl_hours),
            max_value_size=int(max_value_size),
        )

    return RedirectResponse("/integrations/memories", status_code=303)


@router.post("/memories/{label}/delete")
async def delete_memory(label: str):
    async with AsyncSessionLocal() as session:
        repository = PipelineMemoryRepository(session)

        # Delete all entries for this memory label
        await session.execute(delete(PipelineMemoryRow).where(PipelineMemoryRow.label == label))

        # Delete the configuration
        await repository.delete_config(label)

        await session.commit()
    return RedirectResponse("/integrations/memories", status_code=303)
