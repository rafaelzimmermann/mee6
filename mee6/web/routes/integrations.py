from pathlib import Path

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from mee6.config import settings
from mee6.integrations.whatsapp_session import wa_session
from mee6.scheduler.engine import scheduler

router = APIRouter(prefix="/integrations")
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


def _wa_ctx() -> dict:
    return {
        "wa_status": wa_session.status.value,
        "wa_qr_svg": wa_session.get_qr_svg(),
        "wa_error": wa_session.error,
        "notify_phone": settings.notify_phone_number,
    }


@router.get("", response_class=HTMLResponse)
async def integrations_page(request: Request):
    return templates.TemplateResponse(
        request,
        "integrations.html",
        {"active_count": scheduler.active_job_count(), **_wa_ctx()},
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
        return HTMLResponse(
            f'<span class="badge badge-error">Error: {exc}</span>'
        )
