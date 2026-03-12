from pathlib import Path

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from mee6.scheduler.engine import scheduler

router = APIRouter(prefix="/triggers")
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@router.get("", response_class=HTMLResponse)
async def list_triggers(request: Request):
    jobs = scheduler.list_jobs()
    active_count = scheduler.active_job_count()
    return templates.TemplateResponse(
        request, "triggers.html", {"jobs": jobs, "active_count": active_count}
    )


@router.post("")
async def create_trigger(
    agent_name: str = Form(...),
    cron_expr: str = Form(...),
    enabled: bool = Form(False),
):
    await scheduler.add_trigger(agent_name, cron_expr, enabled=enabled)
    return RedirectResponse("/triggers", status_code=303)


@router.post("/{job_id}/toggle")
async def toggle_trigger(job_id: str):
    await scheduler.toggle_trigger(job_id)
    return RedirectResponse("/triggers", status_code=303)


@router.post("/{job_id}/run-now")
async def run_now(job_id: str):
    await scheduler.run_now(job_id)
    return RedirectResponse("/triggers", status_code=303)


@router.post("/{job_id}/delete")
async def delete_trigger(job_id: str):
    await scheduler.remove_trigger(job_id)
    return RedirectResponse("/triggers", status_code=303)
