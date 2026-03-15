from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class MonitorRequest(BaseModel):
    callback_url: str
    phones: List[str]
    group_jids: List[str]


class SendMessageRequest(BaseModel):
    recipient: str
    message: str
    is_group: bool = False


@router.get("/status")
async def get_status():
    return {"status": "disconnected", "qr_svg": None}


@router.post("/connect")
async def connect():
    return {"ok": True}


@router.post("/disconnect")
async def disconnect():
    return {"ok": True}


@router.get("/groups")
async def get_groups():
    return []


@router.post("/monitor")
async def monitor(request: MonitorRequest):
    return {"ok": True}


@router.post("/send")
async def send_message(request: SendMessageRequest):
    return {"ok": True}
