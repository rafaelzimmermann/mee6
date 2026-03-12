from pathlib import Path

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from mee6.db.engine import AsyncSessionLocal
from mee6.db.repository import WhatsAppGroupRepository
from mee6.pipelines.store import pipeline_store
from mee6.scheduler.engine import TriggerType, scheduler

router = APIRouter(prefix="/triggers")
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@router.get("", response_class=HTMLResponse)
async def list_triggers(request: Request):
    jobs = scheduler.list_jobs()
    active_count = scheduler.active_job_count()
    pipelines = await pipeline_store.list()
    async with AsyncSessionLocal() as session:
        wa_groups = await WhatsAppGroupRepository(session).list_all()
    return templates.TemplateResponse(
        request,
        "triggers.html",
        {
            "jobs": jobs,
            "active_count": active_count,
            "pipelines": pipelines,
            "wa_groups": wa_groups,
            "TriggerType": TriggerType,
        },
    )


@router.post("")
async def create_trigger(
    pipeline_id: str = Form(...),
    pipeline_name: str = Form(...),
    trigger_type: TriggerType = Form(TriggerType.CRON),
    cron_expr: str = Form(""),
    phone: str = Form(""),
    group_jid: str = Form(""),
    enabled: bool = Form(False),
):
    if trigger_type == TriggerType.WHATSAPP:
        await scheduler.add_whatsapp_trigger(pipeline_id, pipeline_name, phone, enabled=enabled)
    elif trigger_type == TriggerType.WA_GROUP:
        await scheduler.add_wa_group_trigger(pipeline_id, pipeline_name, group_jid, enabled=enabled)
    else:
        await scheduler.add_trigger(pipeline_id, pipeline_name, cron_expr, enabled=enabled)
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
