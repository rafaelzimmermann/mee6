import logging
import urllib.parse
import uuid

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from mee6.config import settings
from mee6.db.engine import AsyncSessionLocal
from mee6.db.models import CalendarRow, WhatsAppGroupRow
from mee6.db.repository import CalendarRepository, WhatsAppGroupRepository
from mee6.integrations.whatsapp_session import wa_session
from mee6.scheduler.engine import scheduler
from mee6.web.templates_env import templates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations")


def _wa_ctx() -> dict:
    return {
        "wa_status": wa_session.status.value,
        "wa_qr_svg": wa_session.get_qr_svg(),
        "wa_error": wa_session.error,
        "notify_phone": settings.notify_phone_number,
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
            "active_count": scheduler.active_job_count(),
            "wa_groups": await _wa_groups(),
            "calendars": await _calendars(),
            **_wa_ctx(),
        },
    )


@router.post("/whatsapp/connect")
async def whatsapp_connect():
    await wa_session.connect()
    return RedirectResponse("/integrations", status_code=303)


@router.get("/whatsapp/status", response_class=HTMLResponse)
async def whatsapp_status(request: Request):
    """HTMX partial — returns the WhatsApp status card fragment."""
    return templates.TemplateResponse(request, "_whatsapp_status.html", _wa_ctx())


@router.post("/whatsapp/test", response_class=HTMLResponse)
async def whatsapp_test(phone: str = Form(...)):
    """Send a test message and return an inline result fragment."""
    from mee6.integrations.whatsapp import send_notification

    try:
        await send_notification(phone=phone, message="mee6: connection succeeded ✓")
        return HTMLResponse(
            f'<span class="badge badge-connected">✓ message sent to {phone}</span>'
        )
    except Exception as exc:
        logger.exception("WhatsApp test message to %s failed", phone)
        return HTMLResponse(
            f'<span class="badge badge-error">Error: {exc!s:.200}</span>'
        )


@router.post("/whatsapp/groups/sync")
async def sync_wa_groups():
    """Fetch all groups from WhatsApp and upsert them into the local DB."""
    from mee6.integrations.whatsapp import list_groups

    try:
        remote = await list_groups()
    except Exception as exc:
        logger.exception("Failed to sync WhatsApp groups")
        return RedirectResponse(
            f"/integrations?error={urllib.parse.quote(str(exc), safe='')}",
            status_code=303,
        )

    async with AsyncSessionLocal() as session:
        repo = WhatsAppGroupRepository(session)
        for g in remote:
            existing = await repo.get(g["jid"])
            # Preserve user's custom label; fall back to WA group name
            label = existing.label if existing and existing.label else g["name"]
            await repo.upsert(
                WhatsAppGroupRow(jid=g["jid"], name=g["name"], label=label)
            )

    return RedirectResponse("/integrations", status_code=303)


@router.post("/whatsapp/groups/{jid:path}/label")
async def update_wa_group_label(jid: str, label: str = Form(...)):
    async with AsyncSessionLocal() as session:
        await WhatsAppGroupRepository(session).update_label(jid, label.strip())
    return RedirectResponse("/integrations", status_code=303)


@router.post("/whatsapp/groups/{jid:path}/delete")
async def delete_wa_group(jid: str):
    async with AsyncSessionLocal() as session:
        await WhatsAppGroupRepository(session).delete(jid)
    return RedirectResponse("/integrations", status_code=303)


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
