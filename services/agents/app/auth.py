from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import config

bearer_scheme = HTTPBearer()


def require_auth(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)):
    if credentials.credentials != config.agent_service_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Bearer token",
        )
