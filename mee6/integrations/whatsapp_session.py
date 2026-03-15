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
from collections.abc import Callable
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)

# neonize event.list_func key for MessageEv (EVENT_TO_INT[MessageEv] == 17)
_NEONIZE_MESSAGE_EV_CODE = 17


def _parse_wa_timestamp(ts_raw: Any) -> "datetime":
    """Convert a neonize timestamp to a timezone-aware UTC datetime.

    neonize always delivers timestamps as millisecond Unix integers.
    A datetime object with a .timestamp() method is also accepted as a fallback.
    Returns UTC now if ts_raw is None or zero.
    """
    from datetime import datetime, timezone

    if ts_raw is None or ts_raw == 0:
        return datetime.now(timezone.utc)
    if isinstance(ts_raw, (int, float)):
        return datetime.fromtimestamp(ts_raw / 1000, tz=timezone.utc)
    if hasattr(ts_raw, "timestamp"):
        return datetime.fromtimestamp(ts_raw.timestamp(), tz=timezone.utc)
    return datetime.now(timezone.utc)


# _monitor timing constants (seconds)
_MONITOR_POLL_INTERVAL_S = 2
_QR_EXPIRY_TIMEOUT_S = 65
_RECONNECT_DELAY_S = 1


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
        self._on_dm: Callable[[str], None] | None = None
        self._on_group: Callable[[str], None] | None = None
        self._on_dm_allowed: Callable[[str], bool] | None = None
        self._on_group_allowed: Callable[[str], bool] | None = None
        self._own_number: str = ""  # The connected account's phone number

    def get_qr_svg(self) -> str | None:
        if self._qr_data is None:
            return None
        try:
            import segno

            buf = io.BytesIO()
            segno.make_qr(self._qr_data).save(buf, kind="svg", scale=6, border=2, dark="#1a1a2e")
            return buf.getvalue().decode("utf-8")
        except ImportError:
            logger.debug("segno not installed; QR SVG rendering unavailable")
            return None
        except Exception:
            logger.warning("Failed to render QR code as SVG", exc_info=True)
            return None

    async def connect(
        self,
        on_dm: "Callable[[str], None] | None" = None,
        on_group: "Callable[[str], None] | None" = None,
        on_dm_allowed: "Callable[[str], bool] | None" = None,
        on_group_allowed: "Callable[[str], bool] | None" = None,
        own_number: str = "",
    ) -> None:
        if self.status in (WAStatus.CONNECTING, WAStatus.PENDING_QR, WAStatus.CONNECTED):
            return

        from mee6.integrations.whatsapp import _get_channel

        self._on_dm = on_dm
        self._on_group = on_group
        self._on_dm_allowed = on_dm_allowed
        self._on_group_allowed = on_group_allowed
        self._own_number = own_number.lstrip("+")
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
        except ImportError:
            logger.debug("neonize ConnectedEv not available; falling back to polling")
        except Exception:
            logger.warning("Failed to register ConnectedEv handler", exc_info=True)

        # --- DisconnectedEv: reset status on drop ---
        try:
            from neonize.events import DisconnectedEv

            def _on_disconnected(_client: Any, _ev: Any) -> None:
                if self.status == WAStatus.CONNECTED:
                    self.status = WAStatus.DISCONNECTED

            channel._client.event(DisconnectedEv)(_on_disconnected)
        except ImportError:
            logger.debug("neonize DisconnectedEv not available; falling back to polling")
        except Exception:
            logger.warning("Failed to register DisconnectedEv handler", exc_info=True)

        # --- Start listen() in the background ---
        async def _store_incoming(msg: Any) -> None:
            """Persist each incoming message to the DB for later retrieval."""
            try:
                from mee6.db.engine import AsyncSessionLocal
                from mee6.db.models import WhatsAppMessageRow
                from mee6.db.repository import WhatsAppMessageRepository

                # sender_id arrives as "34612345678@s.whatsapp.net" or plain number
                raw_sender: str = getattr(msg, "sender_id", "") or ""
                sender = raw_sender.split("@")[0].lstrip("+")

                ts = _parse_wa_timestamp(getattr(msg, "timestamp", None))
                # Column is TIMESTAMP WITHOUT TIME ZONE — store naive UTC
                ts_naive = ts.replace(tzinfo=None) if ts.tzinfo is not None else ts
                text: str = getattr(msg, "text", "") or ""
                if not text:
                    return  # skip non-text messages (audio, etc.)
                logger.info("Incoming WA message from %s: text=%r", sender, text[:60])
                async with AsyncSessionLocal() as session:
                    repo = WhatsAppMessageRepository(session)
                    await repo.insert(
                        WhatsAppMessageRow(sender=sender, text=text, timestamp=ts_naive)
                    )

                logger.info("Checking WA triggers for sender=%s", sender)
                if self._on_dm:
                    self._on_dm(sender)
            except Exception:
                logger.exception("Error in _store_incoming")  # never crash the listen loop

        async def _store_group_message(chat_jid: str, text: str, ts_raw: Any) -> None:
            """Persist a group message to the DB (runs on the asyncio event loop)."""
            try:
                from mee6.db.engine import AsyncSessionLocal
                from mee6.db.models import WhatsAppMessageRow
                from mee6.db.repository import WhatsAppMessageRepository

                # Only save if this group has an enabled trigger
                if self._on_group_allowed and not self._on_group_allowed(chat_jid):
                    return  # no enabled trigger for this group — ignore silently
                ts = _parse_wa_timestamp(ts_raw)
                ts_naive = ts.replace(tzinfo=None) if ts.tzinfo is not None else ts
                logger.info("Group message in %s: %r", chat_jid, text[:60])
                async with AsyncSessionLocal() as session:
                    await WhatsAppMessageRepository(session).insert(
                        WhatsAppMessageRow(
                            sender="",
                            text=text,
                            timestamp=ts_naive,
                            chat_id=chat_jid,
                        )
                    )

                if self._on_group:
                    self._on_group(chat_jid)
            except Exception:
                logger.exception("Error in _store_group_message")

        async def _run_listen() -> None:
            try:
                await channel.listen(_store_incoming)
            except Exception as exc:
                if self.status not in (WAStatus.CONNECTED,):
                    self.status = WAStatus.ERROR
                    self.error = str(exc)

        # --- Group message capture ---
        # agntrick_whatsapp intentionally rejects group messages (@g.us JIDs).
        # We wrap its MessageEv handler so group messages reach our DB while
        # DMs continue flowing through the original handler unchanged.
        _original_ev_handler = channel._client.event.list_func.get(_NEONIZE_MESSAGE_EV_CODE)
        _loop_ref = asyncio.get_running_loop()

        def _on_message_combined(_client: Any, _ev: Any) -> None:
            try:
                _chat_jid: str = ""
                try:
                    from neonize.utils.jid import Jid2String  # type: ignore[import-untyped]

                    _chat_jid = (
                        Jid2String(_ev.Info.MessageSource.Chat)
                        if _ev.Info.MessageSource.Chat
                        else ""
                    )
                except Exception:
                    pass

                if _chat_jid.endswith("@g.us"):
                    # Extract text the same way agntrick does
                    _text: str = getattr(_ev.Message, "conversation", "")
                    if not _text:
                        _ext = getattr(_ev.Message, "extendedTextMessage", None)
                        if _ext:
                            _text = getattr(_ext, "text", "")
                    if _text:
                        _ts_raw = getattr(_ev.Info, "Timestamp", 0)
                        asyncio.run_coroutine_threadsafe(
                            _store_group_message(_chat_jid, _text, _ts_raw),
                            _loop_ref,
                        )
                    return  # don't pass groups to agntrick's DM-only handler

                # DM — let the original handler do its job
                if _original_ev_handler is not None:
                    _original_ev_handler(_client, _ev)
            except Exception:
                logger.exception("Error in _on_message_combined")

        channel._client.event.list_func[_NEONIZE_MESSAGE_EV_CODE] = _on_message_combined

        asyncio.create_task(_run_listen())
        asyncio.create_task(self._monitor(channel))

    async def _monitor(self, channel: Any) -> None:
        """
        Two jobs:
        1. Poll is_connected() as fallback if ConnectedEv was missed.
        2. Restart the connection if the QR code goes stale (>65 s without a new one).
        """
        while True:
            await asyncio.sleep(_MONITOR_POLL_INTERVAL_S)

            if self.status == WAStatus.CONNECTED:
                return
            if self.status == WAStatus.ERROR:
                return

            # Fallback poll
            try:
                if channel._client and channel._client.is_connected:
                    self.status = WAStatus.CONNECTED
                    self._qr_data = None
                    return
            except Exception:
                logger.warning("is_connected() poll raised an exception", exc_info=True)

            # QR watchdog: neonize should re-fire the callback every ~20 s as
            # each code expires.  If 65 s pass without a refresh, force reconnect.
            if (
                self.status == WAStatus.PENDING_QR
                and self._qr_updated_at > 0
                and time.monotonic() - self._qr_updated_at > _QR_EXPIRY_TIMEOUT_S
            ):
                self.status = WAStatus.DISCONNECTED
                self._qr_data = None
                await asyncio.sleep(_RECONNECT_DELAY_S)
                await self.connect()
                return


wa_session = WhatsAppSession()
