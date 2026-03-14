from fastapi import APIRouter, HTTPException, status

from mee6.scheduler.engine import TriggerMeta, TriggerType, scheduler
from mee6.web.api.models import TriggerResponse
from mee6.web.api.validation import TriggerCreateRequestEnhanced

router = APIRouter()


def _to_response(meta: TriggerMeta) -> TriggerResponse:
    return TriggerResponse(
        id=meta.id,
        pipeline_id=meta.pipeline_id,
        pipeline_name=meta.pipeline_name,
        trigger_type=meta.trigger_type.value,
        cron_expr=meta.cron_expr,
        config=meta.config,
        enabled=meta.enabled,
    )


def _build_config(phone: str | None, group_jid: str | None) -> dict:
    config = {}
    if phone:
        config["phone"] = phone
    if group_jid:
        config["group_jid"] = group_jid
    return config


def _check_exists(trigger_id: str) -> None:
    if trigger_id not in scheduler._jobs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")


@router.post("/", response_model=TriggerResponse, status_code=status.HTTP_201_CREATED)
async def create_trigger(body: TriggerCreateRequestEnhanced):
    trigger_type = TriggerType(body.trigger_type)
    job_id = await scheduler.add_trigger(
        body.pipeline_id,
        body.cron_expr or None,
        trigger_type=trigger_type,
        config=_build_config(body.phone, body.group_jid),
        enabled=body.enabled,
    )
    meta = scheduler._jobs.get(job_id)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve created trigger",
        )
    return _to_response(meta)


@router.post("/{trigger_id}/toggle")
async def toggle_trigger(trigger_id: str):
    _check_exists(trigger_id)
    await scheduler.toggle_trigger(trigger_id)
    meta = scheduler._jobs.get(trigger_id)
    return {"id": trigger_id, "enabled": meta.enabled if meta else False}


@router.post("/{trigger_id}/run-now")
async def run_now(trigger_id: str):
    _check_exists(trigger_id)
    await scheduler.run_now(trigger_id)
    return {"ok": True}


@router.delete("/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trigger(trigger_id: str):
    _check_exists(trigger_id)
    await scheduler.remove_trigger(trigger_id)
