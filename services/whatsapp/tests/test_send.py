import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app
from app.session import session, WAStatus

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_session():
    original_status = session.status
    original_qr_svg = session.qr_svg
    session.status = WAStatus.disconnected
    session.qr_svg = None
    yield
    session.status = original_status
    session.qr_svg = original_qr_svg


def test_send_when_connected_calls_send_message():
    session.status = WAStatus.connected
    session._client = MagicMock()
    session._client.send_message = AsyncMock()

    response = client.post(
        "/send",
        json={"to": "1234567890@s.whatsapp.net", "text": "Hello"},
        headers={"X-Webhook-Secret": "changeme"},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_send_when_disconnected_returns_503():
    session.status = WAStatus.disconnected

    response = client.post(
        "/send",
        json={"to": "1234567890@s.whatsapp.net", "text": "Hello"},
        headers={"X-Webhook-Secret": "changeme"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "WhatsApp session not connected"}


def test_send_with_wrong_secret_returns_401():
    response = client.post(
        "/send",
        json={"to": "1234567890@s.whatsapp.net", "text": "Hello"},
        headers={"X-Webhook-Secret": "wrong_secret"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid secret"}
