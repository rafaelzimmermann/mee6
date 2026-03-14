import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from mee6.db.engine import get_engine
from mee6.db.models import Base
from mee6.scheduler.engine import scheduler
from mee6.web.routes import history, integrations, pipelines, triggers
from mee6.web.api import agents, integrations as api_integrations, pipelines as api_pipelines, triggers as api_triggers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d [%(name)s %(levelname)s] - %(message)s",
    datefmt="%H:%M:%S",
)
# browser_use internals at DEBUG so we can see exactly where it hangs
logging.getLogger("browser_use").setLevel(logging.DEBUG)

STATIC_DIR = Path(__file__).parent / "static"


def _split_sql_statements(sql: str) -> list[str]:
    """Split SQL into individual statements on ';', ignoring ';' inside dollar-quoted blocks."""
    stmts: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(sql)
    dq_tag: str | None = None  # None = not inside a dollar-quoted block

    while i < n:
        ch = sql[i]

        # Detect opening dollar-quote tag: $[word]$ or $$
        if ch == "$" and dq_tag is None:
            j = i + 1
            while j < n and (sql[j].isalpha() or sql[j] == "_" or sql[j].isdigit()):
                j += 1
            if j < n and sql[j] == "$":
                dq_tag = sql[i : j + 1]
                buf.append(dq_tag)
                i = j + 1
                continue

        # Detect closing dollar-quote tag
        if ch == "$" and dq_tag is not None:
            end = i + len(dq_tag)
            if sql[i:end] == dq_tag:
                buf.append(dq_tag)
                i = end
                dq_tag = None
                continue

        # Statement separator (only outside dollar-quoted blocks)
        if ch == ";" and dq_tag is None:
            stmt = "".join(buf).strip()
            meaningful = [
                line
                for line in stmt.splitlines()
                if line.strip() and not line.strip().startswith("--")
            ]
            if meaningful:
                stmts.append(stmt)
            buf = []
        else:
            buf.append(ch)
        i += 1

    last = "".join(buf).strip()
    if last and any(
        line.strip() and not line.strip().startswith("--") for line in last.splitlines()
    ):
        stmts.append(last)
    return stmts


async def _migrate_db() -> None:
    """Run every SQL file in db/migrations/ in sorted order.

    Migration files must be idempotent (use IF NOT EXISTS / DROP IF EXISTS etc.)
    so they are safe to re-execute on every startup without a migrations table.
    Dollar-quoted blocks (DO $$ ... $$) are handled correctly.
    """
    from sqlalchemy import text

    migrations_dir = Path(__file__).parent.parent.parent / "db" / "migrations"
    sql_files = sorted(migrations_dir.glob("*.sql"))

    async with get_engine().begin() as conn:
        for sql_file in sql_files:
            for stmt in _split_sql_statements(sql_file.read_text()):
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

    # Add CORS middleware for frontend development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Static files
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    # Existing template-based routes (for backward compatibility)
    app.include_router(pipelines.router)
    app.include_router(triggers.router)
    app.include_router(integrations.router)
    app.include_router(history.router)

    # New JSON API routes
    app.include_router(api_pipelines.router, prefix="/api/v1/pipelines")
    app.include_router(agents.router, prefix="/api/v1/agents")
    app.include_router(api_triggers.router, prefix="/api/v1/triggers")
    app.include_router(api_integrations.router, prefix="/api/v1/integrations")

    return app


app = create_app()
