import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.session import session, _post_callback, WAStatus


@pytest.fixture(autouse=True)
def reset_session():
    original_registration = session.registration
    original_status = session.status
    original_qr_svg = session.qr_svg
    session.registration = None
    session.status = WAStatus.disconnected
    session.qr_svg = None
    with patch("app.session.Jid2String", side_effect=lambda x: x):
        yield
    session.registration = original_registration
    session.status = original_status
    session.qr_svg = original_qr_svg


@pytest.mark.asyncio
async def test_dm_from_registered_phone_triggers_callback():
    session.register_monitor(
        callback_url="http://example.com/callback",
        phones=["+1234567890"],
        group_jids=[],
    )

    mock_ev = MagicMock()
    mock_ev.Info.IsGroup = False
    mock_ev.Info.Sender = "1234567890@s.whatsapp.net"
    mock_ev.Info.Chat = "1234567890@s.whatsapp.net"
    mock_ev.Message.Conversation = "Hello"

    with patch("app.session._post_callback", new_callable=AsyncMock) as mock_callback:
        await session._on_message_combined(None, mock_ev)
        mock_callback.assert_called_once_with(
            "http://example.com/callback",
            {"type": "dm", "sender": "1234567890@s.whatsapp.net", "text": "Hello"},
        )


@pytest.mark.asyncio
async def test_dm_from_unregistered_phone_no_callback():
    session.register_monitor(
        callback_url="http://example.com/callback",
        phones=["+1234567890"],
        group_jids=[],
    )

    mock_ev = MagicMock()
    mock_ev.Info.IsGroup = False
    mock_ev.Info.Sender = "9999999999@s.whatsapp.net"
    mock_ev.Info.Chat = "9999999999@s.whatsapp.net"
    mock_ev.Message.Conversation = "Hello"

    with patch("app.session._post_callback", new_callable=AsyncMock) as mock_callback:
        await session._on_message_combined(None, mock_ev)
        mock_callback.assert_not_called()


@pytest.mark.asyncio
async def test_group_message_from_registered_jid_triggers_callback():
    session.register_monitor(
        callback_url="http://example.com/callback",
        phones=[],
        group_jids=["1234567890@g.us"],
    )

    mock_ev = MagicMock()
    mock_ev.Info.IsGroup = True
    mock_ev.Info.Chat = "1234567890@g.us"
    mock_ev.Message.Conversation = "Hello group"

    with patch("app.session._post_callback", new_callable=AsyncMock) as mock_callback:
        await session._on_message_combined(None, mock_ev)
        mock_callback.assert_called_once_with(
            "http://example.com/callback",
            {"type": "group", "chat_jid": "1234567890@g.us", "text": "Hello group"},
        )


@pytest.mark.asyncio
async def test_group_message_from_unregistered_jid_no_callback():
    session.register_monitor(
        callback_url="http://example.com/callback",
        phones=[],
        group_jids=["1234567890@g.us"],
    )

    mock_ev = MagicMock()
    mock_ev.Info.IsGroup = True
    mock_ev.Info.Chat = "9999999999@g.us"
    mock_ev.Message.Conversation = "Hello group"

    with patch("app.session._post_callback", new_callable=AsyncMock) as mock_callback:
        await session._on_message_combined(None, mock_ev)
        mock_callback.assert_not_called()


@pytest.mark.asyncio
async def test_message_with_no_text_body_no_callback():
    session.register_monitor(
        callback_url="http://example.com/callback",
        phones=["+1234567890"],
        group_jids=[],
    )

    mock_ev = MagicMock()
    mock_ev.Info.IsGroup = False
    mock_ev.Info.Sender = "1234567890@s.whatsapp.net"
    mock_ev.Info.Chat = "1234567890@s.whatsapp.net"
    mock_ev.Message.Conversation = None
    del mock_ev.Message.ExtendedTextMessage

    with patch("app.session._post_callback", new_callable=AsyncMock) as mock_callback:
        await session._on_message_combined(None, mock_ev)
        mock_callback.assert_not_called()


@pytest.mark.asyncio
async def test_no_registration_set_no_callback():
    session.registration = None

    mock_ev = MagicMock()
    mock_ev.Info.IsGroup = False
    mock_ev.Info.Sender = "1234567890@s.whatsapp.net"
    mock_ev.Info.Chat = "1234567890@s.whatsapp.net"
    mock_ev.Message.Conversation = "Hello"

    with patch("app.session._post_callback", new_callable=AsyncMock) as mock_callback:
        await session._on_message_combined(None, mock_ev)
        mock_callback.assert_not_called()
