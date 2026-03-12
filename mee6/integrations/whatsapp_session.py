"""WhatsApp connection state manager.

Uses neonize's ConnectedEv / DisconnectedEv callbacks for immediate detection,
with is_connected() polling as a fallback.  A QR watchdog restarts the
connection if the QR code hasn't been refreshed within 65 s (neonize normally
re-fires the QR callback automatically as each code expires, but the watchdog
covers the edge case where it doesn't).
"""

import asyncio
import io
import logging
import time
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class WAStatus(str, Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    PENDING_QR = "pending_qr"
    CONNECTED = "connected"
    ERROR = "error"


class WhatsAppSession:
    def __init__(self) -> None:
        self.status: WAStatus = WAStatus.DISCONNECTED
        self._qr_data: bytes | None = None
        self._qr_updated_at: float = 0.0
        self.error: str | None = None

    def get_qr_svg(self) -> str | None:
        if self._qr_data is None:
            return None
        try:
            import segno

            buf = io.BytesIO()
            segno.make_qr(self._qr_data).save(
                buf, kind="svg", scale=6, border=2, dark="#1a1a2e"
            )
            return buf.getvalue().decode("utf-8")
        except Exception:
            return None

    async def connect(self) -> None:
        if self.status in (WAStatus.CONNECTING, WAStatus.PENDING_QR, WAStatus.CONNECTED):
            return

        from mee6.integrations.whatsapp import _get_channel

        self.status = WAStatus.CONNECTING
        self.error = None
        self._qr_data = None
        self._qr_updated_at = 0.0

        try:
            channel = await _get_channel()
        except Exception as exc:
            self.status = WAStatus.ERROR
            self.error = str(exc)
            return

        # --- QR callback (fires from Go thread — safe to set plain attributes) ---
        def _on_qr(_client: Any, data: bytes) -> None:
            self._qr_data = data
            self._qr_updated_at = time.monotonic()
            self.status = WAStatus.PENDING_QR

        channel._client.qr(_on_qr)

        # --- ConnectedEv: immediate detection when QR is scanned ---
        try:
            from neonize.events import ConnectedEv

            def _on_connected(_client: Any, _ev: Any) -> None:
                self.status = WAStatus.CONNECTED
                self._qr_data = None

            channel._client.event(ConnectedEv)(_on_connected)
        except Exception:
            pass  # neonize not available; fall back to polling

        # --- DisconnectedEv: reset status on drop ---
        try:
            from neonize.events import DisconnectedEv

            def _on_disconnected(_client: Any, _ev: Any) -> None:
                if self.status == WAStatus.CONNECTED:
                    self.status = WAStatus.DISCONNECTED

            channel._client.event(DisconnectedEv)(_on_disconnected)
        except Exception:
            pass

        # --- Start listen() in the background ---
        async def _store_incoming(msg: Any) -> None:
            """Persist each incoming message to the DB for later retrieval."""
            try:
                from datetime import datetime, timezone

                from mee6.db.engine import AsyncSessionLocal
                from mee6.db.models import WhatsAppMessageRow
                from mee6.db.repository import WhatsAppMessageRepository

                # sender_id arrives as "34612345678@s.whatsapp.net" or plain number
                raw_sender: str = getattr(msg, "sender_id", "") or ""
                sender = raw_sender.split("@")[0].lstrip("+")

                ts = getattr(msg, "timestamp", None)
                if ts is None:
                    ts = datetime.now(timezone.utc)
                elif isinstance(ts, (int, float)):
                    # Millisecond Unix timestamp (e.g. 1773330464000)
                    ts = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
                elif hasattr(ts, "timestamp"):
                    ts = datetime.fromtimestamp(ts.timestamp(), tz=timezone.utc)

                text: str = getattr(msg, "text", "") or ""
                logger.info("Incoming WA message from %s: text=%r (attrs: %s)", sender, text[:60] if text else "", [a for a in dir(msg) if not a.startswith("_")])
                if not text:
                    return  # skip non-text messages (audio, etc.)

                # Column is TIMESTAMP WITHOUT TIME ZONE — store naive UTC
                ts_naive = ts.replace(tzinfo=None) if ts.tzinfo is not None else ts
                async with AsyncSessionLocal() as session:
                    repo = WhatsAppMessageRepository(session)
                    await repo.insert(WhatsAppMessageRow(sender=sender, text=text, timestamp=ts_naive))

                # Fire any matching WA triggers (import here to avoid circular imports)
                from mee6.scheduler.engine import scheduler

                logger.info("Checking WA triggers for sender=%s", sender)
                scheduler.check_wa_triggers(sender)
            except Exception:
                logger.exception("Error in _store_incoming")  # never crash the listen loop

        async def _run_listen() -> None:
            try:
                await channel.listen(_store_incoming)
            except Exception as exc:
                if self.status not in (WAStatus.CONNECTED,):
                    self.status = WAStatus.ERROR
                    self.error = str(exc)

        asyncio.create_task(_run_listen())
        asyncio.create_task(self._monitor(channel))

    async def _monitor(self, channel: Any) -> None:
        """
        Two jobs:
        1. Poll is_connected() as fallback if ConnectedEv was missed.
        2. Restart the connection if the QR code goes stale (>65 s without a new one).
        """
        while True:
            await asyncio.sleep(2)

            if self.status == WAStatus.CONNECTED:
                return
            if self.status == WAStatus.ERROR:
                return

            # Fallback poll
            try:
                if channel._client and channel._client.is_connected():
                    self.status = WAStatus.CONNECTED
                    self._qr_data = None
                    return
            except Exception:
                pass

            # QR watchdog: neonize should re-fire the callback every ~20 s as
            # each code expires.  If 65 s pass without a refresh, force reconnect.
            if (
                self.status == WAStatus.PENDING_QR
                and self._qr_updated_at > 0
                and time.monotonic() - self._qr_updated_at > 65
            ):
                self.status = WAStatus.DISCONNECTED
                self._qr_data = None
                await asyncio.sleep(1)
                await self.connect()
                return


wa_session = WhatsAppSession()
