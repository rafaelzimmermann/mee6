"""agntrick-whatsapp wrapper for sending outbound notifications.

WhatsApp configuration is loaded from $AGNTRICK_CONFIG_DIR/whatsapp.yaml
(default: ~/.config/agntrick/whatsapp.yaml).

WhatsAppChannel uses the neonize library (WhatsApp Web protocol). On first
run it requires a QR-code scan to establish a session; subsequent runs reuse
the persisted session stored at channel.storage_path.

Minimal whatsapp.yaml:
    channel:
      storage_path: ~/.config/agntrick/whatsapp
    privacy:
      allowed_contact: "+34612345678"
"""

import yaml
from agntrick_whatsapp import WhatsAppAgentConfig, WhatsAppChannel
from agntrick_whatsapp.base import OutgoingMessage

from mee6.config import settings

_channel: WhatsAppChannel | None = None


def _load_whatsapp_config() -> WhatsAppAgentConfig:
    config_path = settings.config_dir / "whatsapp.yaml"
    if not config_path.exists():
        raise FileNotFoundError(
            f"WhatsApp config not found at {config_path}. "
            "Create it with at minimum:\n"
            "  privacy:\n"
            "    allowed_contact: \"+E164phone\"\n"
            "  channel:\n"
            "    storage_path: ~/.config/agntrick/whatsapp"
        )
    with config_path.open() as f:
        data = yaml.safe_load(f) or {}
    return WhatsAppAgentConfig(**data)


async def _get_channel() -> WhatsAppChannel:
    global _channel
    if _channel is None:
        wa_config = _load_whatsapp_config()
        _channel = WhatsAppChannel(
            storage_path=wa_config.get_storage_path(),
            allowed_contact=wa_config.privacy.allowed_contact,
            log_filtered_messages=wa_config.privacy.log_filtered_messages,
            poll_interval=wa_config.whatsapp_bridge.poll_interval_sec,
            typing_indicators=wa_config.features.typing_indicators,
        )
        await _channel.initialize()
    return _channel


async def send_notification(*, phone: str, message: str) -> None:
    """Send a WhatsApp text message to the given phone number (E.164 format)."""
    channel = await _get_channel()
    await channel.send(OutgoingMessage(text=message, recipient_id=phone))


async def read_messages(*, phone: str, limit: int) -> list[str]:
    """Return the last *limit* messages received from *phone* (E.164 or plain digits).

    Messages are returned in chronological order (oldest first) as plain strings.
    """
    from mee6.db.engine import AsyncSessionLocal
    from mee6.db.repository import WhatsAppMessageRepository

    # Normalise: strip leading '+' so "+34…" and "34…" both match
    sender = phone.lstrip("+")

    async with AsyncSessionLocal() as session:
        repo = WhatsAppMessageRepository(session)
        rows = await repo.get_recent_from(sender, limit)

    return [row.text for row in rows]
