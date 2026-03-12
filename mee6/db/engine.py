from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

_engine: AsyncEngine | None = None
_session_local: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        from mee6.config import settings

        _engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    return _engine


def AsyncSessionLocal() -> AsyncSession:
    global _session_local
    if _session_local is None:
        _session_local = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_local()
