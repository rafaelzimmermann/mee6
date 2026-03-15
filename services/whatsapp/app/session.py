import asyncio
import enum
import logging
from dataclasses import dataclass, field
from typing import Optional

from app.config import STORAGE_PATH, WEBHOOK_SECRET

logger = logging.getLogger(__name__)

QR_EXPIRY_SECONDS = 65

# neonize bundles a Go binary and is only available inside Docker.
# Import gracefully so tests can import this module without it installed.
try:
    from neonize.client import NewClient
    from neonize.events import ConnectedEv, DisconnectedEv, MessageEv
except ImportError:
    NewClient = None  # type: ignore[assignment,misc]
    ConnectedEv = DisconnectedEv = MessageEv = None  # type: ignore[assignment]


class WAStatus(str, enum.Enum):
    disconnected = "disconnected"
    connecting = "connecting"
    pending_qr = "pending_qr"
    connected = "connected"
    error = "error"


@dataclass
class MonitorRegistration:
    callback_url: str
    phones: list[str] = field(default_factory=list)
    group_jids: list[str] = field(default_factory=list)


class WASession:
    def __init__(self):
        self.status: WAStatus = WAStatus.disconnected
        self.qr_svg: Optional[str] = None
        self.registration: Optional[MonitorRegistration] = None
        self._client = None
        self._qr_watchdog_task: Optional[asyncio.Task] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self) -> None:
        if self.status in (
            WAStatus.connecting,
            WAStatus.pending_qr,
            WAStatus.connected,
        ):
            return
        self.status = WAStatus.connecting
        self._loop = asyncio.get_event_loop()
        self._client = NewClient(f"{STORAGE_PATH}/session")

        # Register event handlers — neonize 0.3.x uses client.event(Type)(cb)
        self._client.event(ConnectedEv)(self._on_connected)
        self._client.event(DisconnectedEv)(self._on_disconnected)
        self._client.event(MessageEv)(self._on_message)
        # QR uses a separate registration; callback receives raw bytes
        self._client.qr(self._on_qr)

        # connect() is a blocking call — run in thread to avoid blocking the loop
        asyncio.get_event_loop().run_in_executor(None, self._client.connect)

    async def disconnect(self) -> None:
        if self._client:
            await asyncio.get_event_loop().run_in_executor(
                None, self._client.disconnect
            )
        self.status = WAStatus.disconnected
        self.qr_svg = None
        self._cancel_watchdog()

    def register_monitor(
        self, callback_url: str, phones: list[str], group_jids: list[str]
    ) -> None:
        self.registration = MonitorRegistration(
            callback_url=callback_url,
            phones=phones,
            group_jids=group_jids,
        )

    async def send_message(self, to: str, text: str) -> None:
        if not self._client or self.status != WAStatus.connected:
            raise RuntimeError("WhatsApp session not connected")
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: self._client.send_message(to, text)
        )

    def get_groups(self) -> list[dict]:
        if not self._client or self.status != WAStatus.connected:
            return []
        return [
            {"jid": g.JID, "name": g.Name} for g in self._client.get_joined_groups()
        ]

    # --- Synchronous neonize callbacks (called from Go threads) ---

    def _on_connected(self, _client, _ev) -> None:
        logger.info("WhatsApp connected")
        self.status = WAStatus.connected
        self.qr_svg = None
        self._cancel_watchdog()

    def _on_disconnected(self, _client, ev) -> None:
        logger.warning("WhatsApp disconnected: %s", ev)
        self.status = WAStatus.disconnected
        self._cancel_watchdog()

    def _on_qr(self, _client, data_qr: bytes) -> None:
        """Receives raw QR bytes from neonize; converts to SVG for the frontend."""
        import io
        import segno  # installed as neonize transitive dep inside Docker
        logger.info("QR code updated")
        buf = io.BytesIO()
        segno.make_qr(data_qr).save(buf, kind="svg", scale=5, svgid="qr")
        self.qr_svg = buf.getvalue().decode("utf-8")
        self.status = WAStatus.pending_qr
        self._cancel_watchdog()
        if self._loop:
            asyncio.run_coroutine_threadsafe(self._schedule_watchdog(), self._loop)

    def _on_message(self, _client, ev) -> None:
        """Sync wrapper registered with neonize; schedules async routing logic."""
        if self._loop:
            asyncio.run_coroutine_threadsafe(
                self._on_message_combined(_client, ev), self._loop
            )

    # --- Async logic (directly tested) ---

    async def _on_message_combined(self, _client, ev) -> None:
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
            phone = sender.split("@")[0]
            if not any(p.lstrip("+") in phone for p in self.registration.phones):
                return
            payload = {"type": "dm", "sender": sender, "text": text}
        await _post_callback(self.registration.callback_url, payload)

    async def _schedule_watchdog(self) -> None:
        self._qr_watchdog_task = asyncio.create_task(self._qr_watchdog())

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


def _extract_text(ev) -> Optional[str]:
    try:
        return ev.Message.Conversation or ev.Message.ExtendedTextMessage.Text
    except AttributeError:
        return None


import httpx


async def _post_callback(url: str, payload: dict) -> None:
    headers = {"X-Webhook-Secret": WEBHOOK_SECRET, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.post(url, json=payload, headers=headers)
            if r.status_code >= 400:
                raise httpx.HTTPStatusError(
                    "callback failed", request=r.request, response=r
                )
        except Exception as e:
            logger.warning("Callback failed (%s), retrying once: %s", url, e)
            try:
                async with httpx.AsyncClient(timeout=10) as retry_client:
                    await retry_client.post(url, json=payload, headers=headers)
            except Exception as e2:
                logger.error("Callback retry failed: %s", e2)


session = WASession()
