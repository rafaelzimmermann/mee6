"""API response models for the mee6 REST API."""

from pydantic import BaseModel, Field
from typing import Optional, List

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
    """Response model for a trigger, built from TriggerMeta."""

    id: str = Field(..., description="Unique trigger ID")
    pipeline_id: str = Field(..., description="Associated pipeline ID")
    pipeline_name: str = Field(..., description="Pipeline name")
    trigger_type: str = Field(..., description="Type of trigger: cron, whatsapp, wa_group")
    cron_expr: Optional[str] = Field(None, description="Cron expression for scheduled triggers")
    config: dict = Field(default_factory=dict, description="Trigger configuration")
    enabled: bool = Field(default=True, description="Whether trigger is enabled")


# Integration responses
class WhatsAppStatusResponse(BaseModel):
    """Response model for WhatsApp connection status."""

    status: str = Field(..., description="disconnected | connecting | pending_qr | connected | error")
    qr_svg: Optional[str] = Field(None, description="SVG string for QR code display")
    error: Optional[str] = Field(None, description="Error message if status is error")
    notify_phone: str = Field(default="", description="Default notification phone number")


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
    count: int = Field(default=0, description="Current number of stored entries")


# Agent field responses
class AgentResponse(BaseModel):
    """Response model for agent plugin."""

    name: str = Field(..., description="Agent type name")
    label: str = Field(..., description="User-friendly label")


class FieldSchemaResponse(BaseModel):
    """Response model for field schema."""

    name: str = Field(..., description="Field name")
    label: str = Field(..., description="Field label")
    field_type: str = Field(
        ..., description="Field type: text, textarea, checkbox, select, combobox, etc."
    )
    placeholder: Optional[str] = Field(None, description="Placeholder text")
    required: bool = Field(default=False, description="Whether field is required")
    options: Optional[List[str]] = Field(None, description="Options for select/combobox fields")


# Request models
class PipelineCreateRequest(BaseModel):
    """Request model for pipeline creation/update."""

    name: str = Field(..., description="Pipeline name")
    steps: List[dict] = Field(..., description="Pipeline steps")


class WhatsAppPhoneRequest(BaseModel):
    """Request model for setting WhatsApp phone number."""

    phone: str = Field(..., description="Phone number")


class CalendarCreateRequest(BaseModel):
    """Request model for calendar configuration."""

    label: str = Field(..., description="User-friendly label")
    calendar_id: str = Field(..., description="Google Calendar ID")


class WhatsAppGroupLabelRequest(BaseModel):
    """Request model for updating a WhatsApp group label."""

    label: str = Field(..., description="New label for the group")


class WhatsAppTestRequest(BaseModel):
    """Request model for sending a WhatsApp test message."""

    phone: str = Field(..., description="Phone number in E.164 format")


class MemoryConfigRequest(BaseModel):
    """Request model for memory configuration."""

    label: str = Field(..., description="Memory label")
    max_memories: int = Field(default=20, description="Maximum number of memories to store")
    ttl_hours: int = Field(default=720, description="Time to live in hours")
    max_value_size: int = Field(default=2000, description="Maximum size of a memory value")
