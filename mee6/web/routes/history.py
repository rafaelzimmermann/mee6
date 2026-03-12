from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from mee6.scheduler.engine import scheduler

router = APIRouter()
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@router.get("/", response_class=HTMLResponse)
async def history(request: Request):
    runs = scheduler.get_recent_runs()
    active_count = scheduler.active_job_count()
    return templates.TemplateResponse(
        request, "history.html", {"runs": runs, "active_count": active_count}
    )


@router.get("/history/rows", response_class=HTMLResponse)
async def history_rows(request: Request):
    """HTMX partial — returns only the table rows for auto-polling."""
    runs = scheduler.get_recent_runs()
    return templates.TemplateResponse(request, "_history_rows.html", {"runs": runs})
