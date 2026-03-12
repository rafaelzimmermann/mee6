"""agntrick-whatsapp wrapper for sending outbound notifications.

WhatsAppChannel uses the neonize library (WhatsApp Web protocol) and requires
system-level dependencies (libmagic, Go runtime bundled in neonize).
The channel must be initialized once (QR scan) before it can send messages.
Session data is persisted in WHATSAPP_STORAGE_PATH.
"""

from agntrick_whatsapp import WhatsAppChannel
from agntrick_whatsapp.base import OutgoingMessage

from mee6.config import settings

_channel: WhatsAppChannel | None = None


async def _get_channel() -> WhatsAppChannel:
    global _channel
    if _channel is None:
        _channel = WhatsAppChannel(
            storage_path=settings.whatsapp_storage_path,
            allowed_contact=settings.notify_phone_number,
        )
        await _channel.initialize()
    return _channel


async def send_notification(*, phone: str, message: str) -> None:
    """Send a WhatsApp text message to the given phone number (E.164 format)."""
    channel = await _get_channel()
    await channel.send(OutgoingMessage(text=message, recipient_id=phone))
