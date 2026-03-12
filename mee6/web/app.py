from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from mee6.scheduler.engine import scheduler
from mee6.web.routes import dashboard, triggers

TEMPLATES_DIR = Path(__file__).parent / "templates"
STATIC_DIR = Path(__file__).parent / "static"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await scheduler.start()
    yield
    await scheduler.stop()


def create_app() -> FastAPI:
    app = FastAPI(title="mee6", lifespan=lifespan)
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    app.include_router(dashboard.router)
    app.include_router(triggers.router)
    return app


app = create_app()
