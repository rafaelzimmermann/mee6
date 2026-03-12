from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from mee6.config import settings

async_engine = create_async_engine(settings.database_url, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)
