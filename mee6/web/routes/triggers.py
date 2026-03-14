from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from mee6.db.engine import AsyncSessionLocal
from mee6.db.repository import WhatsAppGroupRepository
from mee6.pipelines.store import pipeline_store
from mee6.scheduler.engine import TriggerType, scheduler
from mee6.web.templates_env import templates

router = APIRouter(prefix="/triggers")


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
