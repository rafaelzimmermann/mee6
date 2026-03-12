import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from mee6.db.engine import async_engine
from mee6.db.models import Base
from mee6.scheduler.engine import scheduler
from mee6.web.routes import history, integrations, pipelines, triggers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d [%(name)s %(levelname)s] - %(message)s",
    datefmt="%H:%M:%S",
)
# browser_use internals at DEBUG so we can see exactly where it hangs
logging.getLogger("browser_use").setLevel(logging.DEBUG)

TEMPLATES_DIR = Path(__file__).parent / "templates"
STATIC_DIR = Path(__file__).parent / "static"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


async def _migrate_db() -> None:
    """Apply additive schema migrations that create_all cannot handle."""
    from sqlalchemy import text

    migrations = [
        # v2: trigger_type + config columns; cron_expr becomes nullable
        "ALTER TABLE triggers ADD COLUMN IF NOT EXISTS trigger_type VARCHAR NOT NULL DEFAULT 'cron'",
        "ALTER TABLE triggers ADD COLUMN IF NOT EXISTS config JSONB",
        "ALTER TABLE triggers ALTER COLUMN cron_expr DROP NOT NULL",
    ]
    async with async_engine.begin() as conn:
        for stmt in migrations:
            await conn.execute(text(stmt))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _migrate_db()
    await scheduler.start()
    # Reconnect WhatsApp in the background if a session file already exists.
    # connect() is a no-op if the config file is missing, so this is always safe.
    from mee6.integrations.whatsapp_session import wa_session

    asyncio.create_task(wa_session.connect())
    yield
    await scheduler.stop()


def create_app() -> FastAPI:
    app = FastAPI(title="mee6", lifespan=lifespan)
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    app.include_router(history.router)
    app.include_router(triggers.router)
    app.include_router(pipelines.router)
    app.include_router(integrations.router)
    return app


app = create_app()
