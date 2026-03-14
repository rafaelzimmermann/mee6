"""Enhanced validation models for the mee6 REST API.

Uses Pydantic validators to ensure data integrity.
"""

from pydantic import BaseModel, field_validator
from typing import Optional
import re


class PipelineCreateRequestEnhanced(BaseModel):
    """Enhanced request model for pipeline creation/update with validation."""

    name: str
    steps: list[dict]

    @field_validator("name")
    @classmethod
    def name_validation(cls, v):
        if not v or not v.strip():
            raise ValueError("Pipeline name is required")
        if len(v) > 100:
            raise ValueError("Pipeline name must be less than 100 characters")
        return v.strip()

    @field_validator("steps")
    @classmethod
    def at_least_one_step(cls, v):
        if not v or len(v) == 0:
            raise ValueError("Pipeline must have at least one step")
        return v

    @field_validator("steps", mode="wrap")
    @classmethod
    def validate_step_structure(cls, v, handler):
        """Validate each step has required fields."""
        steps = handler(v)
        for i, step in enumerate(steps):
            if not isinstance(step, dict):
                raise ValueError(f"Step {i + 1} must be a dictionary")
            if "agent_type" not in step or not step["agent_type"]:
                raise ValueError(f"Step {i + 1}: agent_type is required")
            if "config" not in step:
                step["config"] = {}
            elif not isinstance(step["config"], dict):
                raise ValueError(f"Step {i + 1}: config must be a dictionary")
        return steps


class TriggerCreateRequestEnhanced(BaseModel):
    """Enhanced request model for trigger creation with validation."""

    name: str
    pipeline_id: str
    trigger_type: str
    enabled: bool = True
    cron_expression: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_validation(cls, v):
        if not v or not v.strip():
            raise ValueError("Trigger name is required")
        if len(v) > 100:
            raise ValueError("Trigger name must be less than 100 characters")
        return v.strip()

    @field_validator("trigger_type")
    @classmethod
    def trigger_type_validation(cls, v):
        valid_types = ["cron", "whatsapp", "manual"]
        if v not in valid_types:
            raise ValueError(f"Trigger type must be one of: {', '.join(valid_types)}")
        return v

    @field_validator("pipeline_id")
    @classmethod
    def pipeline_id_validation(cls, v):
        if not v or not v.strip():
            raise ValueError("Pipeline ID is required")
        return v.strip()


class MemoryConfigRequestEnhanced(BaseModel):
    """Enhanced request model for memory configuration with validation."""

    label: str
    max_memories: int = 20
    ttl_hours: int = 720
    max_value_size: int = 2000

    @field_validator("label")
    @classmethod
    def label_validation(cls, v):
        if not v or not v.strip():
            raise ValueError("Label is required")
        if len(v) > 50:
            raise ValueError("Label must be less than 50 characters")
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Label can only contain letters, numbers, underscores, and hyphens")
        return v.strip()

    @field_validator("max_memories")
    @classmethod
    def max_memories_validation(cls, v):
        if v < 1:
            raise ValueError("max_memories must be at least 1")
        if v > 1000:
            raise ValueError("max_memories must be less than 1000")
        return v

    @field_validator("ttl_hours")
    @classmethod
    def ttl_hours_validation(cls, v):
        if v < 1:
            raise ValueError("ttl_hours must be at least 1")
        if v > 87600:  # 10 years
            raise ValueError("ttl_hours must be less than 87600 (10 years)")
        return v

    @field_validator("max_value_size")
    @classmethod
    def max_value_size_validation(cls, v):
        if v < 0:
            raise ValueError("max_value_size cannot be negative")
        if v > 100000:  # 100KB
            raise ValueError("max_value_size must be less than 100000")
        return v
