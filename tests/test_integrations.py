"""Tests for the integration modules."""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import yaml

# ---------------------------------------------------------------------------
# calendar
# ---------------------------------------------------------------------------


def test_create_event_timed():
    mock_service = MagicMock()
    mock_events = mock_service.events.return_value
    mock_insert = mock_events.insert.return_value
    mock_insert.execute.return_value = {"id": "event-123"}

    with (
        patch("mee6.integrations.calendar.Credentials"),
        patch("mee6.integrations.calendar.build", return_value=mock_service),
    ):
        from mee6.integrations.calendar import create_event

        create_event(
            calendar_id="primary",
            credentials_file="fake_credentials.json",
            title="Parent Meeting",
            start="2026-03-20T17:00:00",
            end="2026-03-20T18:00:00",
            description="Annual conference",
        )

    mock_events.insert.assert_called_once()
    body = mock_events.insert.call_args[1]["body"]
    assert body["summary"] == "Parent Meeting"
    assert body["start"]["dateTime"] == "2026-03-20T17:00:00"


def test_create_event_all_day():
    mock_service = MagicMock()

    with (
        patch("mee6.integrations.calendar.Credentials"),
        patch("mee6.integrations.calendar.build", return_value=mock_service),
    ):
        from mee6.integrations.calendar import create_event

        create_event(
            calendar_id="primary",
            credentials_file="fake_credentials.json",
            title="Spring Break",
            start="2026-04-06",
            end="2026-04-06",
            description="School closed",
        )

    body = mock_service.events().insert.call_args[1]["body"]
    assert body["start"] == {"date": "2026-04-06"}
    assert body["end"] == {"date": "2026-04-06"}


# ---------------------------------------------------------------------------
# whatsapp — config loading
# ---------------------------------------------------------------------------


def _write_whatsapp_yaml(tmp_path: Path, content: dict) -> Path:
    config_dir = tmp_path / ".config" / "agntrick"
    config_dir.mkdir(parents=True)
    config_file = config_dir / "whatsapp.yaml"
    config_file.write_text(yaml.dump(content))
    return config_dir


@pytest.mark.asyncio
async def test_whatsapp_send_notification(tmp_path):
    config_dir = _write_whatsapp_yaml(
        tmp_path,
        {
            "privacy": {"allowed_contact": "+34612345678"},
            "channel": {"storage_path": str(tmp_path / "whatsapp")},
        },
    )

    mock_channel = AsyncMock()
    mock_channel.initialize = AsyncMock()
    mock_channel.send = AsyncMock()

    with (
        patch("mee6.integrations.whatsapp.settings") as mock_settings,
        patch("mee6.integrations.whatsapp.WhatsAppChannel", return_value=mock_channel),
        patch("mee6.integrations.whatsapp._channel", None),
    ):
        mock_settings.config_dir = config_dir

        import mee6.integrations.whatsapp as wa_mod

        wa_mod._channel = None  # reset singleton

        from mee6.integrations.whatsapp import send_notification

        await send_notification(phone="+34612345678", message="Hello!")

    mock_channel.initialize.assert_awaited_once()
    mock_channel.send.assert_awaited_once()
    sent = mock_channel.send.call_args[0][0]
    assert sent.text == "Hello!"
    assert sent.recipient_id == "+34612345678"


def test_whatsapp_config_missing_raises(tmp_path):
    config_dir = tmp_path / ".config" / "agntrick"
    config_dir.mkdir(parents=True)
    # no whatsapp.yaml

    with patch("mee6.integrations.whatsapp.settings") as mock_settings:
        mock_settings.config_dir = config_dir

        from mee6.integrations.whatsapp import _load_whatsapp_config

        with pytest.raises(FileNotFoundError, match="whatsapp.yaml"):
            _load_whatsapp_config()
