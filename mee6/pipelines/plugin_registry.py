"""Single registration point for all available agent plugins."""

from mee6.pipelines.plugins.browser_agent import BrowserAgentPlugin
from mee6.pipelines.plugins.calendar_agent import CalendarAgentPlugin
from mee6.pipelines.plugins.llm_agent import LlmAgentPlugin
from mee6.pipelines.plugins.whatsapp_agent import WhatsAppAgentPlugin
from mee6.pipelines.plugins.whatsapp_group_read import WhatsAppGroupReadPlugin
from mee6.pipelines.plugins.whatsapp_group_send import WhatsAppGroupSendPlugin
from mee6.pipelines.plugins.whatsapp_read import WhatsAppReadPlugin

AGENT_PLUGINS: dict[str, object] = {
    "llm_agent": LlmAgentPlugin(),
    "browser_agent": BrowserAgentPlugin(),
    "whatsapp_read": WhatsAppReadPlugin(),
    "whatsapp_group_read": WhatsAppGroupReadPlugin(),
    "whatsapp_group_send": WhatsAppGroupSendPlugin(),
    "whatsapp_agent": WhatsAppAgentPlugin(),
    "calendar_agent": CalendarAgentPlugin(),
}
