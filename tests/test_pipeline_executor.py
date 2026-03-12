"""Tests for the pipeline executor and agent plugins."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mee6.pipelines.models import Pipeline, PipelineStep

# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_executor_chains_step_output():
    """Output of step N becomes previous_output for step N+1."""
    plugin_a = MagicMock()
    plugin_a.run = AsyncMock(return_value="step-a-output")
    plugin_b = MagicMock()
    plugin_b.run = AsyncMock(return_value="step-b-output")

    with patch.dict(
        "mee6.pipelines.executor.AGENT_PLUGINS",
        {"plugin_a": plugin_a, "plugin_b": plugin_b},
    ):
        from mee6.pipelines.executor import run_pipeline

        pipeline = Pipeline(
            id="p1",
            name="test",
            steps=[
                PipelineStep(agent_type="plugin_a", config={"k": "v"}),
                PipelineStep(agent_type="plugin_b", config={"k": "w"}),
            ],
        )
        result = await run_pipeline(pipeline)

    plugin_a.run.assert_awaited_once_with({"k": "v"}, previous_output="")
    plugin_b.run.assert_awaited_once_with({"k": "w"}, previous_output="step-a-output")
    assert result["summary"] == "2 step(s) completed"
    assert result["final_output"] == "step-b-output"


@pytest.mark.asyncio
async def test_executor_unknown_agent_raises():
    from mee6.pipelines.executor import run_pipeline

    pipeline = Pipeline(
        id="p1",
        name="test",
        steps=[PipelineStep(agent_type="does_not_exist", config={})],
    )
    with pytest.raises(ValueError, match="does_not_exist"):
        await run_pipeline(pipeline)


@pytest.mark.asyncio
async def test_executor_empty_pipeline():
    from mee6.pipelines.executor import run_pipeline

    pipeline = Pipeline(id="p1", name="empty", steps=[])
    result = await run_pipeline(pipeline)
    assert result["summary"] == "0 step(s) completed"
    assert result["final_output"] == ""


# ---------------------------------------------------------------------------
# BrowserAgentPlugin
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_browser_plugin_substitutes_previous_output():
    with patch(
        "mee6.agents.browser_agent.agent.browse",
        AsyncMock(return_value="3 years"),
    ) as mock_browse:
        from mee6.pipelines.plugins.browser_agent import BrowserAgentPlugin

        plugin = BrowserAgentPlugin()
        result = await plugin.run(
            {"task": "Find experience at {previous_output}"},
            previous_output="https://example.com",
        )

    mock_browse.assert_awaited_once_with("Find experience at https://example.com")
    assert result == "3 years"


@pytest.mark.asyncio
async def test_browser_plugin_empty_previous_output():
    with patch(
        "mee6.agents.browser_agent.agent.browse",
        AsyncMock(return_value="done"),
    ) as mock_browse:
        from mee6.pipelines.plugins.browser_agent import BrowserAgentPlugin

        plugin = BrowserAgentPlugin()
        await plugin.run({"task": "Do something"}, previous_output="")

    mock_browse.assert_awaited_once_with("Do something")


# ---------------------------------------------------------------------------
# WhatsAppAgentPlugin
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_whatsapp_plugin_substitutes_and_sends():
    with patch(
        "mee6.integrations.whatsapp.send_notification",
        AsyncMock(),
    ) as mock_send:
        from mee6.pipelines.plugins.whatsapp_agent import WhatsAppAgentPlugin

        plugin = WhatsAppAgentPlugin()
        result = await plugin.run(
            {"phone": "+34111222333", "message_template": "Info: {previous_output}"},
            previous_output="5 years",
        )

    mock_send.assert_awaited_once_with(phone="+34111222333", message="Info: 5 years")
    assert result == "Info: 5 years"


@pytest.mark.asyncio
async def test_whatsapp_plugin_returns_rendered_message():
    with patch("mee6.integrations.whatsapp.send_notification", AsyncMock()):
        from mee6.pipelines.plugins.whatsapp_agent import WhatsAppAgentPlugin

        plugin = WhatsAppAgentPlugin()
        result = await plugin.run(
            {"phone": "+34000", "message_template": "Hello {previous_output}!"},
            previous_output="world",
        )

    assert result == "Hello world!"
