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
    original_client = session._client
    session.status = WAStatus.disconnected
    session.qr_svg = None
    session._client = None
    yield
    session.status = original_status
    session.qr_svg = original_qr_svg
    session._client = original_client


def test_get_status_returns_disconnected_on_fresh_container():
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json() == {"status": "disconnected", "qr_svg": None}


def test_connect_returns_202():
    with patch("app.session.NewClient") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        response = client.post("/connect")
        assert response.status_code == 202
        assert response.json() == {"ok": True}


def test_disconnect_returns_200():
    session._client = MagicMock()
    session._client.disconnect = AsyncMock()
    session.status = WAStatus.connected

    response = client.post("/disconnect")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_get_groups_returns_empty_when_disconnected():
    response = client.get("/groups")
    assert response.status_code == 200
    assert response.json() == []


def test_get_groups_returns_groups_when_connected():
    session.status = WAStatus.connected
    mock_group = MagicMock()
    mock_group.JID = "1234567890@g.us"
    mock_group.Name = "Test Group"

    mock_client = MagicMock()
    mock_client.get_joined_groups = MagicMock(return_value=[mock_group])
    session._client = mock_client

    response = client.get("/groups")
    assert response.status_code == 200
    assert response.json() == [{"jid": "1234567890@g.us", "name": "Test Group"}]
