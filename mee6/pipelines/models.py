"""Pydantic models for pipelines — used for JSON serialisation."""

from pydantic import BaseModel


class PipelineStep(BaseModel):
    agent_type: str
    config: dict[str, str]


class Pipeline(BaseModel):
    id: str
    name: str
    steps: list[PipelineStep] = []
