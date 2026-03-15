import os
import pytest
from fastapi.testclient import TestClient

os.environ["ANTHROPIC_API_KEY"] = "test-api-key"
os.environ["ANTHROPIC_MODEL"] = "claude-3-5-sonnet-20241022"
os.environ["AGENT_SERVICE_SECRET"] = "test-secret"

from app.main import app
from app.config import config


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {config.agent_service_secret}"}
