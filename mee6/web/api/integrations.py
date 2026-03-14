"""REST API routes for integrations (WhatsApp, Calendar, Memory)."""

import uuid

from fastapi import APIRouter, HTTPException, status

from mee6.config import settings
from mee6.db.engine import AsyncSessionLocal
from mee6.db.models import CalendarRow, WhatsAppGroupRow
from mee6.db.repository import (
    CalendarRepository,
    MemoryRepository,
    WhatsAppGroupRepository,
    WhatsAppSettingsRepository,
)
from mee6.integrations import whatsapp as wa
from mee6.integrations.whatsapp_session import wa_session
from mee6.web.api.models import (
    CalendarCreateRequest,
    CalendarResponse,
    MemoryConfigResponse,
    WhatsAppGroupLabelRequest,
    WhatsAppGroupResponse,
    WhatsAppPhoneRequest,
    WhatsAppStatusResponse,
    WhatsAppTestRequest,
)
from mee6.web.api.validation import MemoryConfigRequestEnhanced

router = APIRouter()


# --- WhatsApp ---

@router.get("/whatsapp/status", response_model=WhatsAppStatusResponse)
async def whatsapp_status():
    async with AsyncSessionLocal() as session:
        phone = await WhatsAppSettingsRepository(session).get_phone_number()
    return WhatsAppStatusResponse(
        status=wa_session.status.value,
        qr_svg=wa_session.get_qr_svg(),
        error=wa_session.error,
        notify_phone=phone,
    )


@router.post("/whatsapp/connect", status_code=status.HTTP_204_NO_CONTENT)
async def connect_whatsapp():
    from mee6.scheduler.engine import scheduler
    await wa_session.connect(
        on_dm=scheduler.check_wa_triggers,
        on_group=scheduler.check_wa_group_triggers,
        on_dm_allowed=scheduler.has_wa_trigger,
        on_group_allowed=scheduler.has_wa_group_trigger,
    )


@router.post("/whatsapp/phone", status_code=status.HTTP_204_NO_CONTENT)
async def set_whatsapp_phone(body: WhatsAppPhoneRequest):
    async with AsyncSessionLocal() as session:
        await WhatsAppSettingsRepository(session).set_phone_number(body.phone.strip())


@router.post("/whatsapp/sync")
async def sync_whatsapp_groups():
    try:
        groups = await wa.list_groups()
        async with AsyncSessionLocal() as session:
            repo = WhatsAppGroupRepository(session)
            for g in groups:
                await repo.upsert(WhatsAppGroupRow(jid=g["jid"], name=g["name"], label=g["name"]))
        return {"updated": len(groups), "message": f"Synced {len(groups)} groups."}
    except Exception:
        return {"updated": 0, "message": "Sync failed."}


@router.get("/whatsapp/groups", response_model=list[WhatsAppGroupResponse])
async def list_whatsapp_groups():
    async with AsyncSessionLocal() as session:
        groups = await WhatsAppGroupRepository(session).list_all()
    return [WhatsAppGroupResponse(name=g.name, jid=g.jid) for g in groups]


@router.patch("/whatsapp/groups/{jid}/label", status_code=status.HTTP_204_NO_CONTENT)
async def update_whatsapp_group_label(jid: str, body: WhatsAppGroupLabelRequest):
    async with AsyncSessionLocal() as session:
        await WhatsAppGroupRepository(session).update_label(jid, body.label.strip())


@router.delete("/whatsapp/groups/{jid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_whatsapp_group(jid: str):
    async with AsyncSessionLocal() as session:
        await WhatsAppGroupRepository(session).delete(jid)


@router.post("/whatsapp/test")
async def test_whatsapp(body: WhatsAppTestRequest):
    if wa_session.status.value != "connected":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="WhatsApp is not connected")
    await wa.send_notification(phone=body.phone, message="Test message from mee6")
    return {"ok": True}


# --- Calendar ---

@router.get("/calendars", response_model=list[CalendarResponse])
async def list_calendars():
    async with AsyncSessionLocal() as session:
        rows = await CalendarRepository(session).list_all()
    return [CalendarResponse(id=r.id, label=r.label, calendar_id=r.calendar_id) for r in rows]


@router.post("/calendars", response_model=CalendarResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar(body: CalendarCreateRequest):
    row = CalendarRow(
        id=str(uuid.uuid4()),
        label=body.label.strip(),
        calendar_id=body.calendar_id.strip(),
        credentials_file=settings.google_credentials_file or "",
    )
    async with AsyncSessionLocal() as session:
        await CalendarRepository(session).upsert(row)
    return CalendarResponse(id=row.id, label=row.label, calendar_id=row.calendar_id)


@router.delete("/calendars/{cal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar(cal_id: str):
    async with AsyncSessionLocal() as session:
        await CalendarRepository(session).delete(cal_id)


# --- Memory ---

@router.get("/memories", response_model=list[MemoryConfigResponse])
async def list_memories():
    async with AsyncSessionLocal() as session:
        repo = MemoryRepository(session)
        configs = await repo.list_configs()
        return [
            MemoryConfigResponse(
                label=cfg.label,
                max_memories=cfg.max_memories,
                ttl_hours=cfg.ttl_hours,
                max_value_size=cfg.max_value_size,
                count=await repo.count_entries(cfg.id),
            )
            for cfg in configs
        ]


@router.get("/memories/labels")
async def list_memory_labels():
    async with AsyncSessionLocal() as session:
        configs = await MemoryRepository(session).list_configs()
    return [cfg.label for cfg in configs]


@router.post("/memories", response_model=MemoryConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(body: MemoryConfigRequestEnhanced):
    async with AsyncSessionLocal() as session:
        await MemoryRepository(session).set_config(
            label=body.label,
            max_memories=body.max_memories,
            ttl_hours=body.ttl_hours,
            max_value_size=body.max_value_size,
        )
    return MemoryConfigResponse(
        label=body.label,
        max_memories=body.max_memories,
        ttl_hours=body.ttl_hours,
        max_value_size=body.max_value_size,
        count=0,
    )


@router.delete("/memories/{label}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(label: str):
    async with AsyncSessionLocal() as session:
        await MemoryRepository(session).delete_config(label)
