"""REST API module for mee6.

This module contains JSON-only API endpoints for frontend consumption.
The API follows REST conventions and returns JSON responses.
"""

from mee6.web.api import agents, integrations, pipelines, triggers
from mee6.web.api.models import (
    AgentResponse,
    CalendarCreateRequest,
    CalendarResponse,
    FieldSchemaResponse,
    MemoryConfigResponse,
    PipelineCreateRequest,
    PipelineCreateResponse,
    PipelineResponse,
    TriggerResponse,
    WhatsAppGroupLabelRequest,
    WhatsAppGroupResponse,
    WhatsAppStatusResponse,
    WhatsAppTestRequest,
)
from mee6.web.api.validation import (
    MemoryConfigRequestEnhanced,
    PipelineCreateRequestEnhanced,
    TriggerCreateRequestEnhanced,
)

__all__ = [
    # Routers
    "agents",
    "integrations",
    "pipelines",
    "triggers",
    # Response models
    "AgentResponse",
    "CalendarCreateRequest",
    "CalendarResponse",
    "FieldSchemaResponse",
    "MemoryConfigResponse",
    "PipelineCreateRequest",
    "PipelineCreateResponse",
    "PipelineResponse",
    "TriggerResponse",
    "WhatsAppGroupLabelRequest",
    "WhatsAppGroupResponse",
    "WhatsAppStatusResponse",
    "WhatsAppTestRequest",
    # Validation models
    "MemoryConfigRequestEnhanced",
    "PipelineCreateRequestEnhanced",
    "TriggerCreateRequestEnhanced",
]
