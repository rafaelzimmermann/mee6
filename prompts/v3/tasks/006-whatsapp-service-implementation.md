# Task 006 — WhatsApp Service Implementation

## Goal

Flesh out the `services/whatsapp/` FastAPI application so that it manages a
real neonize WhatsApp session, accepts registrations from Rails, routes inbound
messages to Rails via HTTP callback, and exposes all required endpoints. The
stub endpoints created in Task 001 are replaced with working implementations.

---

## Prerequisites

- Task 001 complete: `services/whatsapp/` scaffolded with FastAPI, neonize,
  pyproject.toml, and stub endpoints.

---

## Implementation steps

### 1. Configuration

`services/whatsapp/app/config.py`

All values come from environment variables. No `.env` file is read by the
service itself — the environment is injected by Docker Compose or the shell.

```python
import os

RAILS_BASE_URL: str = os.environ.get("RAILS_BASE_URL", "http://localhost:3000")
WEBHOOK_SECRET: str = os.environ.get("WEBHOOK_SECRET", "changeme")
STORAGE_PATH: str = os.environ.get("STORAGE_PATH", "/data/whatsapp")
```

`STORAGE_PATH` is the directory neonize uses to persist its session credentials
across container restarts.

---

### 2. Session management

`services/whatsapp/app/session.py`

Port and adapt the v2 `whatsapp_session.py` logic. Key responsibilities:
- Hold the neonize `NewAClient` instance.
- Track `WAStatus` and expose it to the router.
- Fire the QR watchdog when QR is displayed.
- Call back Rails when an inbound message matches a monitored phone or group.

```python
import asyncio
import enum
import logging
from dataclasses import dataclass, field
from typing import Optional

from neonize.client import NewAClient
from neonize.events import ConnectedEv, DisconnectedEv, QRChangedEv, MessageEv
from neonize.utils.enum import ReceiptType

from app.config import STORAGE_PATH, RAILS_BASE_URL, WEBHOOK_SECRET

logger = logging.getLogger(__name__)

QR_EXPIRY_SECONDS = 65

class WAStatus(str, enum.Enum):
    disconnected = "disconnected"
    connecting   = "connecting"
    pending_qr   = "pending_qr"
    connected    = "connected"
    error        = "error"

@dataclass
class MonitorRegistration:
    callback_url: str
    phones: list[str] = field(default_factory=list)
    group_jids: list[str] = field(default_factory=list)
```

#### `WASession` class

```python
class WASession:
    def __init__(self):
        self.status: WAStatus = WAStatus.disconnected
        self.qr_svg: Optional[str] = None
        self.registration: Optional[MonitorRegistration] = None
        self._client: Optional[NewAClient] = None
        self._qr_watchdog_task: Optional[asyncio.Task] = None

    # ── Public API ──────────────────────────────────────────────────────────

    async def connect(self) -> None:
        """Initialise the neonize client and start connecting."""
        if self.status in (WAStatus.connecting, WAStatus.pending_qr, WAStatus.connected):
            return
        self.status = WAStatus.connecting
        self._client = NewAClient(f"{STORAGE_PATH}/session")
        self._client.event.on(ConnectedEv,    self._on_connected)
        self._client.event.on(DisconnectedEv, self._on_disconnected)
        self._client.event.on(QRChangedEv,    self._on_qr)
        self._client.event.on(MessageEv,      self._on_message_combined)
        asyncio.create_task(self._client.connect())

    async def disconnect(self) -> None:
        if self._client:
            await self._client.disconnect()
        self.status = WAStatus.disconnected
        self.qr_svg = None
        self._cancel_watchdog()

    def register_monitor(self, callback_url: str, phones: list[str], group_jids: list[str]) -> None:
        """Replace any existing registration."""
        self.registration = MonitorRegistration(
            callback_url=callback_url,
            phones=phones,
            group_jids=group_jids,
        )

    async def send_message(self, to: str, text: str) -> None:
        if not self._client or self.status != WAStatus.connected:
            raise RuntimeError("WhatsApp session not connected")
        await self._client.send_message(to, text)

    def get_groups(self) -> list[dict]:
        if not self._client or self.status != WAStatus.connected:
            return []
        return [
            {"jid": g.JID, "name": g.Name}
            for g in self._client.get_joined_groups()
        ]

    # ── Event handlers ──────────────────────────────────────────────────────

    async def _on_connected(self, _client, _ev: ConnectedEv) -> None:
        logger.info("WhatsApp connected")
        self.status = WAStatus.connected
        self.qr_svg = None
        self._cancel_watchdog()

    async def _on_disconnected(self, _client, ev: DisconnectedEv) -> None:
        logger.warning("WhatsApp disconnected: %s", ev)
        self.status = WAStatus.disconnected
        self._cancel_watchdog()

    async def _on_qr(self, _client, ev: QRChangedEv) -> None:
        logger.info("QR code updated")
        self.status = WAStatus.pending_qr
        self.qr_svg = ev.QR   # neonize provides SVG string
        self._cancel_watchdog()
        self._qr_watchdog_task = asyncio.create_task(self._qr_watchdog())

    async def _on_message_combined(self, _client, ev: MessageEv) -> None:
        """Route DMs and group messages to the registered callback."""
        if self.registration is None:
            return

        msg = ev.Info
        is_group = msg.IsGroup
        text = _extract_text(ev)
        if not text:
            return

        if is_group:
            chat_jid = str(msg.Chat)
            if chat_jid not in self.registration.group_jids:
                return
            payload = {"type": "group", "chat_jid": chat_jid, "text": text}
        else:
            sender = str(msg.Sender)
            # Normalise: strip @s.whatsapp.net suffix for comparison
            phone = sender.split("@")[0]
            if not any(p.lstrip("+") in phone for p in self.registration.phones):
                return
            payload = {"type": "dm", "sender": sender, "text": text}

        await _post_callback(self.registration.callback_url, payload)

    # ── QR watchdog ─────────────────────────────────────────────────────────

    async def _qr_watchdog(self) -> None:
        await asyncio.sleep(QR_EXPIRY_SECONDS)
        if self.status == WAStatus.pending_qr:
            logger.warning("QR expired — attempting reconnect")
            self.status = WAStatus.disconnected
            self.qr_svg = None
            await self.connect()

    def _cancel_watchdog(self) -> None:
        if self._qr_watchdog_task and not self._qr_watchdog_task.done():
            self._qr_watchdog_task.cancel()
        self._qr_watchdog_task = None
```

#### Module-level helpers

```python
def _extract_text(ev: MessageEv) -> Optional[str]:
    """Pull plain text from a MessageEv, or None if unsupported type."""
    try:
        return ev.Message.Conversation or ev.Message.ExtendedTextMessage.Text
    except AttributeError:
        return None

import httpx

async def _post_callback(url: str, payload: dict) -> None:
    """POST payload to callback URL; retry once on failure."""
    headers = {"X-Webhook-Secret": WEBHOOK_SECRET, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.post(url, json=payload, headers=headers)
            if r.status_code >= 400:
                raise httpx.HTTPStatusError("callback failed", request=r.request, response=r)
        except Exception as e:
            logger.warning("Callback failed (%s), retrying once: %s", url, e)
            try:
                async with httpx.AsyncClient(timeout=10) as retry_client:
                    await retry_client.post(url, json=payload, headers=headers)
            except Exception as e2:
                logger.error("Callback retry failed: %s", e2)

# Singleton instance shared across the FastAPI app
session = WASession()
```

---

### 3. Router / endpoints

`services/whatsapp/app/router.py`

```python
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from app.session import session, WAStatus
from app.config import WEBHOOK_SECRET

router = APIRouter()
```

#### `GET /status`

```python
@router.get("/status")
async def get_status():
    return {
        "status": session.status.value,
        "qr_svg": session.qr_svg if session.status == WAStatus.pending_qr else None,
    }
```

#### `POST /connect`

```python
@router.post("/connect", status_code=202)
async def connect():
    await session.connect()
    return {"ok": True}
```

#### `POST /disconnect`

```python
@router.post("/disconnect")
async def disconnect():
    await session.disconnect()
    return {"ok": True}
```

#### `GET /groups`

```python
@router.get("/groups")
async def get_groups():
    return session.get_groups()
```

#### `POST /monitor`

```python
class MonitorRequest(BaseModel):
    callback_url: str
    phones: list[str] = []
    group_jids: list[str] = []

@router.post("/monitor")
async def register_monitor(body: MonitorRequest, x_webhook_secret: Optional[str] = Header(None)):
    if x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    session.register_monitor(
        callback_url=body.callback_url,
        phones=body.phones,
        group_jids=body.group_jids,
    )
    return {"ok": True}
```

#### `POST /send`

```python
class SendRequest(BaseModel):
    to: str
    text: str

@router.post("/send")
async def send_message(body: SendRequest, x_webhook_secret: Optional[str] = Header(None)):
    if x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    try:
        await session.send_message(body.to, body.text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"ok": True}
```

---

### 4. FastAPI entry point

`services/whatsapp/app/main.py`

```python
from fastapi import FastAPI
from app.router import router

app = FastAPI(title="mee6-whatsapp")
app.include_router(router)

@app.on_event("startup")
async def startup():
    # Do not auto-connect on boot — Rails will POST /connect when needed.
    pass
```

---

### 5. Tests

`services/whatsapp/tests/` — use `pytest` + `pytest-asyncio` + `httpx` test
client. Stub neonize and httpx calls with `unittest.mock.AsyncMock` /
`MagicMock`.

#### `test_registration.py`

Key cases:
- `POST /monitor` with correct secret stores `registration` on the session
- `POST /monitor` with wrong secret → 401
- A second `POST /monitor` replaces the first registration

#### `test_message_routing.py`

Call `session._on_message_combined` directly with a mock `MessageEv`.

Key cases:
- DM from a registered phone → `_post_callback` is called with `type: "dm"`
- DM from an unregistered phone → no callback
- Group message from a registered JID → callback with `type: "group"`
- Group message from an unregistered JID → no callback
- Message with no text body → no callback
- No registration set → no callback

#### `test_send.py`

Key cases:
- `POST /send` when `session.status == connected` → `session.send_message`
  called with correct args
- `POST /send` when disconnected → 503
- `POST /send` with wrong secret → 401

---

## File / class list

| Path | Description |
|---|---|
| `services/whatsapp/app/config.py` | Env-var configuration |
| `services/whatsapp/app/session.py` | `WAStatus` enum, `MonitorRegistration`, `WASession` class, `session` singleton |
| `services/whatsapp/app/router.py` | All FastAPI route handlers |
| `services/whatsapp/app/main.py` | FastAPI app creation and startup hook |
| `services/whatsapp/tests/test_registration.py` | /monitor endpoint specs |
| `services/whatsapp/tests/test_message_routing.py` | Inbound message routing specs |
| `services/whatsapp/tests/test_send.py` | /send endpoint specs |

---

## Acceptance criteria

- [ ] `GET /status` returns `{ "status": "disconnected", "qr_svg": null }` on
      a fresh container before any connection attempt
- [ ] `POST /connect` returns 202 and transitions status to `connecting` or
      `pending_qr` (depending on whether a saved session exists)
- [ ] `POST /monitor` with valid secret stores registration; a subsequent call
      replaces the previous one
- [ ] A simulated DM `MessageEv` for a registered phone triggers an HTTP POST
      to the callback URL (verified in tests via mock)
- [ ] A simulated DM for an unregistered phone does not trigger a callback
- [ ] `POST /send` when disconnected returns 503
- [ ] `pytest services/whatsapp/tests/` passes with zero failures
