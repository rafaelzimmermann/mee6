import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app
from app.session import session, WAStatus

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_session():
    original_registration = session.registration
    original_status = session.status
    original_qr_svg = session.qr_svg
    session.registration = None
    session.status = WAStatus.disconnected
    session.qr_svg = None
    yield
    session.registration = original_registration
    session.status = original_status
    session.qr_svg = original_qr_svg


def test_monitor_with_correct_secret_stores_registration():
    response = client.post(
        "/monitor",
        json={
            "callback_url": "http://example.com/callback",
            "phones": ["+1234567890"],
            "group_jids": ["1234567890@g.us"],
        },
        headers={"X-Webhook-Secret": "changeme"},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert session.registration is not None
    assert session.registration.callback_url == "http://example.com/callback"
    assert session.registration.phones == ["+1234567890"]
    assert session.registration.group_jids == ["1234567890@g.us"]


def test_monitor_with_wrong_secret_returns_401():
    response = client.post(
        "/monitor",
        json={
            "callback_url": "http://example.com/callback",
            "phones": ["+1234567890"],
            "group_jids": [],
        },
        headers={"X-Webhook-Secret": "wrong_secret"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid secret"}
    assert session.registration is None


def test_second_monitor_call_replaces_first_registration():
    client.post(
        "/monitor",
        json={
            "callback_url": "http://example.com/callback1",
            "phones": ["+1111111111"],
            "group_jids": [],
        },
        headers={"X-Webhook-Secret": "changeme"},
    )

    response = client.post(
        "/monitor",
        json={
            "callback_url": "http://example.com/callback2",
            "phones": ["+2222222222"],
            "group_jids": ["9876543210@g.us"],
        },
        headers={"X-Webhook-Secret": "changeme"},
    )

    assert response.status_code == 200
    assert session.registration.callback_url == "http://example.com/callback2"
    assert session.registration.phones == ["+2222222222"]
    assert session.registration.group_jids == ["9876543210@g.us"]
