"""WhatsApp connection state manager.

Uses neonize's ConnectedEv / DisconnectedEv callbacks for immediate detection,
with is_connected() polling as a fallback.  A QR watchdog restarts the
connection if the QR code hasn't been refreshed within 65 s (neonize normally
re-fires the QR callback automatically as each code expires, but the watchdog
covers the edge case where it doesn't).
"""

import asyncio
import io
import time
from enum import Enum
from typing import Any


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
        async def _noop_incoming(_msg: Any) -> None:
            pass

        async def _run_listen() -> None:
            try:
                await channel.listen(_noop_incoming)
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
