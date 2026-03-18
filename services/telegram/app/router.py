from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional

from app.config import TELEGRAM_SERVICE_SECRET
from app.session import session, TGStatus

router = APIRouter()


@router.get("/status")
async def get_status():
    return {
        "status": session.status.value,
        "bot": session.get_bot_info() if session.status == TGStatus.connected else None,
    }


class ConnectRequest(BaseModel):
    bot_token: str


@router.post("/connect", status_code=202)
async def connect(
    body: ConnectRequest,
    x_telegram_service_secret: Optional[str] = Header(None),
):
    if x_telegram_service_secret != TELEGRAM_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    from app import store
    store.save_token(body.bot_token)
    await session.connect(body.bot_token)
    return {"ok": True}


@router.post("/disconnect")
async def disconnect(x_telegram_service_secret: Optional[str] = Header(None)):
    if x_telegram_service_secret != TELEGRAM_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    await session.disconnect()
    return {"ok": True}


class MonitorRequest(BaseModel):
    callback_url: str
    user_ids: list[str] = []
    chat_ids: list[str] = []


@router.post("/monitor")
async def register_monitor(
    body: MonitorRequest,
    x_telegram_service_secret: Optional[str] = Header(None),
):
    if x_telegram_service_secret != TELEGRAM_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    session.register_monitor(
        callback_url=body.callback_url,
        user_ids=body.user_ids,
        chat_ids=body.chat_ids,
    )
    return {"ok": True}


@router.get("/contacts")
async def get_contacts(x_telegram_service_secret: Optional[str] = Header(None)):
    if x_telegram_service_secret != TELEGRAM_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    from app import store
    return store.load_contacts()


class SendRequest(BaseModel):
    to: str
    text: str


@router.post("/send")
async def send_message(
    body: SendRequest,
    x_telegram_service_secret: Optional[str] = Header(None),
):
    if x_telegram_service_secret != TELEGRAM_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    try:
        await session.send_message(body.to, body.text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"ok": True}
