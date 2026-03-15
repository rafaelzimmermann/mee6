from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from app.session import session, WAStatus
from app.config import WEBHOOK_SECRET

router = APIRouter()


@router.get("/status")
async def get_status():
    return {
        "status": session.status.value,
        "qr_svg": session.qr_svg if session.status == WAStatus.pending_qr else None,
    }


@router.post("/connect", status_code=202)
async def connect():
    await session.connect()
    return {"ok": True}


@router.post("/disconnect")
async def disconnect():
    await session.disconnect()
    return {"ok": True}


@router.get("/groups")
async def get_groups():
    return session.get_groups()


class MonitorRequest(BaseModel):
    callback_url: str
    phones: list[str] = []
    group_jids: list[str] = []


@router.post("/monitor")
async def register_monitor(
    body: MonitorRequest, x_webhook_secret: Optional[str] = Header(None)
):
    if x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    session.register_monitor(
        callback_url=body.callback_url,
        phones=body.phones,
        group_jids=body.group_jids,
    )
    return {"ok": True}


class SendRequest(BaseModel):
    to: str
    text: str


@router.post("/send")
async def send_message(
    body: SendRequest, x_webhook_secret: Optional[str] = Header(None)
):
    if x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    try:
        await session.send_message(body.to, body.text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"ok": True}
