from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from mee6.scheduler.engine import scheduler

router = APIRouter()
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    runs = scheduler.get_recent_runs()
    active_count = scheduler.active_job_count()
    return templates.TemplateResponse(
        request, "dashboard.html", {"runs": runs, "active_count": active_count}
    )
