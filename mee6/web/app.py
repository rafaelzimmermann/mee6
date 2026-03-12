import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from mee6.db.engine import get_engine
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

STATIC_DIR = Path(__file__).parent / "static"


async def _migrate_db() -> None:
    """Run every SQL file in db/migrations/ in sorted order.

    Migration files must be idempotent (use IF NOT EXISTS / DROP IF EXISTS etc.)
    so they are safe to re-execute on every startup without a migrations table.
    """
    from sqlalchemy import text

    migrations_dir = Path(__file__).parent.parent.parent / "db" / "migrations"
    sql_files = sorted(migrations_dir.glob("*.sql"))

    async with get_engine().begin() as conn:
        for sql_file in sql_files:
            for stmt in sql_file.read_text().split(";"):
                stmt = stmt.strip()
                # skip blank lines and comment-only blocks
                meaningful = [l for l in stmt.splitlines() if l.strip() and not l.strip().startswith("--")]
                if meaningful:
                    await conn.execute(text(stmt))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _migrate_db()
    await scheduler.start()
    # Reconnect WhatsApp in the background if a session file already exists.
    # connect() is a no-op if the config file is missing, so this is always safe.
    from mee6.integrations.whatsapp_session import wa_session

    asyncio.create_task(
        wa_session.connect(
            on_dm=scheduler.check_wa_triggers,
            on_group=scheduler.check_wa_group_triggers,
            on_dm_allowed=scheduler.has_wa_trigger,
            on_group_allowed=scheduler.has_wa_group_trigger,
        )
    )
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
