"""API response models for the mee6 REST API."""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# Pipeline responses
class PipelineResponse(BaseModel):
    """Response model for pipeline data."""
    id: str = Field(..., description="Unique pipeline identifier")
    name: str = Field(..., description="Pipeline name")
    steps: List[dict] = Field(default_factory=list, description="Pipeline steps")


class PipelineCreateResponse(BaseModel):
    """Response model for pipeline creation."""
    id: str = Field(..., description="ID of the created pipeline")
    message: str = Field(..., description="Success message")


# Trigger responses
class TriggerResponse(BaseModel):
    """Response model for trigger data."""
    job_id: str = Field(..., description="Unique trigger job ID")
    name: str = Field(..., description="Trigger name")
    trigger_type: str = Field(..., description="Type of trigger: cron, whatsapp, manual")
    enabled: bool = Field(default=True, description="Whether trigger is enabled")
    cron_expression: Optional[str] = Field(None, description="Cron expression for scheduled triggers")
    next_run: Optional[datetime] = Field(None, description="Next scheduled run time")


# History/Run record responses
class RunRecordResponse(BaseModel):
    """Response model for pipeline run record."""
    id: str = Field(..., description="Unique run record ID")
    pipeline_id: str = Field(..., description="ID of the pipeline that ran")
    pipeline_name: str = Field(..., description="Name of the pipeline")
    status: str = Field(..., description="Run status: pending, running, completed, failed")
    started_at: datetime = Field(..., description="When the run started")
    completed_at: Optional[datetime] = Field(None, description="When the run completed")
    error_message: Optional[str] = Field(None, description="Error message if failed")


class RunningCountResponse(BaseModel):
    """Response model for running pipeline count."""
    count: int = Field(..., description="Number of currently running pipelines")


# Integration responses
class WhatsAppStatusResponse(BaseModel):
    """Response model for WhatsApp connection status."""
    connected: bool = Field(..., description="Whether WhatsApp is connected")
    phone: str = Field(default="", description="Phone number")


class WhatsAppGroupResponse(BaseModel):
    """Response model for WhatsApp group."""
    name: str = Field(..., description="Group name")
    jid: str = Field(..., description="Group JID")


class CalendarResponse(BaseModel):
    """Response model for calendar configuration."""
    id: str = Field(..., description="Calendar identifier")
    label: str = Field(..., description="User-friendly label")
    calendar_id: str = Field(..., description="Google Calendar ID")


class MemoryConfigResponse(BaseModel):
    """Response model for memory configuration."""
    label: str = Field(..., description="Memory label")
    max_memories: int = Field(default=20, description="Maximum number of memories to store")
    ttl_hours: int = Field(default=720, description="Time to live in hours")
    max_value_size: int = Field(default=2000, description="Maximum size of a memory value")


# Agent field responses
class AgentResponse(BaseModel):
    """Response model for agent plugin."""
    name: str = Field(..., description="Agent type name")
    label: str = Field(..., description="User-friendly label")


class FieldSchemaResponse(BaseModel):
    """Response model for field schema."""
    name: str = Field(..., description="Field name")
    label: str = Field(..., description="Field label")
    field_type: str = Field(..., description="Field type: text, textarea, checkbox, select, combobox, etc.")
    placeholder: Optional[str] = Field(None, description="Placeholder text")
    required: bool = Field(default=False, description="Whether field is required")
    options: Optional[List[str]] = Field(None, description="Options for select/combobox fields")


# Request models
class PipelineCreateRequest(BaseModel):
    """Request model for pipeline creation/update."""
    name: str = Field(..., description="Pipeline name")
    steps: List[dict] = Field(..., description="Pipeline steps")


class TriggerCreateRequest(BaseModel):
    """Request model for trigger creation."""
    name: str = Field(..., description="Trigger name")
    pipeline_id: str = Field(..., description="Associated pipeline ID")
    trigger_type: str = Field(..., description="Type of trigger: cron, whatsapp, manual")
    enabled: bool = Field(default=True, description="Whether trigger is enabled")
    cron_expression: Optional[str] = Field(None, description="Cron expression for scheduled triggers")


class WhatsAppPhoneRequest(BaseModel):
    """Request model for setting WhatsApp phone number."""
    phone: str = Field(..., description="Phone number")


class CalendarCreateRequest(BaseModel):
    """Request model for calendar configuration."""
    label: str = Field(..., description="User-friendly label")
    calendar_id: str = Field(..., description="Google Calendar ID")
    credentials_file: str = Field(..., description="Path to credentials file")


class MemoryConfigRequest(BaseModel):
    """Request model for memory configuration."""
    label: str = Field(..., description="Memory label")
    max_memories: int = Field(default=20, description="Maximum number of memories to store")
    ttl_hours: int = Field(default=720, description="Time to live in hours")
    max_value_size: int = Field(default=2000, description="Maximum size of a memory value")
