"""Single registration point for all available agent plugins."""

from mee6.pipelines.plugins.browser_agent import BrowserAgentPlugin
from mee6.pipelines.plugins.llm_agent import LlmAgentPlugin
from mee6.pipelines.plugins.whatsapp_agent import WhatsAppAgentPlugin

AGENT_PLUGINS: dict[str, object] = {
    "llm_agent": LlmAgentPlugin(),
    "browser_agent": BrowserAgentPlugin(),
    "whatsapp_agent": WhatsAppAgentPlugin(),
}
