"""Single registration point for all available agent plugins."""

from mee6.pipelines.base import AgentPlugin
from mee6.pipelines.plugins.browser_agent import BrowserAgentPlugin
from mee6.pipelines.plugins.calendar_agent import CalendarAgentPlugin
from mee6.pipelines.plugins.llm_agent import LlmAgentPlugin
from mee6.pipelines.plugins.memory_agent import MemoryAgentPlugin
from mee6.pipelines.plugins.whatsapp_agent import WhatsAppAgentPlugin
from mee6.pipelines.plugins.whatsapp_group_read import WhatsAppGroupReadPlugin
from mee6.pipelines.plugins.whatsapp_group_send import WhatsAppGroupSendPlugin
from mee6.pipelines.plugins.whatsapp_read import WhatsAppReadPlugin

_ALL_PLUGINS = [
    LlmAgentPlugin(),
    BrowserAgentPlugin(),
    WhatsAppReadPlugin(),
    WhatsAppGroupReadPlugin(),
    WhatsAppGroupSendPlugin(),
    WhatsAppAgentPlugin(),
    CalendarAgentPlugin(),
    MemoryAgentPlugin(),
]

# Keyed by plugin.name — each plugin is authoritative for its own key.
AGENT_PLUGINS: dict[str, AgentPlugin] = {p.name: p for p in _ALL_PLUGINS}
