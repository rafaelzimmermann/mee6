"""REST API module for mee6.

This module contains JSON-only API endpoints for frontend consumption.
The API follows REST conventions and returns JSON responses.
"""

from mee6.web.api import agents, pipelines
from mee6.web.api.models import (
    AgentResponse,
    CalendarResponse,
    FieldSchemaResponse,
    MemoryConfigResponse,
    PipelineCreateRequest,
    PipelineCreateResponse,
    PipelineResponse,
    TriggerResponse,
    WhatsAppGroupResponse,
    WhatsAppStatusResponse,
)
from mee6.web.api.validation import (
    MemoryConfigRequestEnhanced,
    PipelineCreateRequestEnhanced,
    TriggerCreateRequestEnhanced,
)

__all__ = [
    # Routers
    "agents",
    "pipelines",
    # Response models
    "AgentResponse",
    "CalendarResponse",
    "FieldSchemaResponse",
    "MemoryConfigResponse",
    "PipelineCreateRequest",
    "PipelineCreateResponse",
    "PipelineResponse",
    "TriggerResponse",
    "WhatsAppGroupResponse",
    "WhatsAppStatusResponse",
    # Validation models
    "MemoryConfigRequestEnhanced",
    "PipelineCreateRequestEnhanced",
    "TriggerCreateRequestEnhanced",
]
