from unittest.mock import MagicMock, patch
from app.agents.browser_agent import BrowserAgent


def test_browser_agent_schema_has_correct_fields():
    agent = BrowserAgent()
    schema = agent.schema()

    assert schema["label"] == "Browser Agent"
    assert len(schema["fields"]) == 2

    task_field = next(f for f in schema["fields"] if f["name"] == "task")
    assert task_field["field_type"] == "textarea"
    assert task_field["required"] is True

    start_url_field = next(f for f in schema["fields"] if f["name"] == "start_url")
    assert start_url_field["field_type"] == "text"
    assert start_url_field["required"] is False


@patch("app.agents.browser_agent.sync_playwright")
@patch("anthropic.Anthropic")
def test_run_with_mocked_playwright_does_not_raise(
    mock_anthropic, mock_sync_playwright
):
    mock_context = MagicMock()
    mock_page = MagicMock()

    mock_sync_playwright.return_value.__enter__.return_value = mock_context
    mock_context.chromium.launch.return_value.new_page.return_value = mock_page

    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text="Task completed successfully")]

    mock_anthropic.return_value.messages.create.return_value = mock_response

    agent = BrowserAgent()
    output = agent.run({"task": "Navigate to example.com"}, "input")

    assert output == "Task completed successfully"
    mock_sync_playwright.assert_called_once()
    mock_context.chromium.launch.assert_called_once_with(headless=True)


@patch("app.agents.browser_agent.sync_playwright")
@patch("anthropic.Anthropic")
def test_input_placeholder_resolved_before_browser_interaction(
    mock_anthropic, mock_sync_playwright
):
    mock_context = MagicMock()
    mock_page = MagicMock()

    mock_sync_playwright.return_value.__enter__.return_value = mock_context
    mock_context.chromium.launch.return_value.new_page.return_value = mock_page

    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text="done")]

    mock_anthropic.return_value.messages.create.return_value = mock_response

    agent = BrowserAgent()
    agent.run({"task": "Go to {input}"}, "https://example.com")

    call_args = mock_anthropic.return_value.messages.create.call_args
    assert call_args.kwargs["messages"][0]["content"] == "Go to https://example.com"


@patch("app.agents.browser_agent.sync_playwright")
@patch("anthropic.Anthropic")
def test_start_url_navigates_if_provided(mock_anthropic, mock_sync_playwright):
    mock_context = MagicMock()
    mock_page = MagicMock()

    mock_sync_playwright.return_value.__enter__.return_value = mock_context
    mock_context.chromium.launch.return_value.new_page.return_value = mock_page

    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text="done")]

    mock_anthropic.return_value.messages.create.return_value = mock_response

    agent = BrowserAgent()
    agent.run({"task": "test", "start_url": "https://test.com"}, "input")

    mock_page.goto.assert_called_once_with("https://test.com")


@patch("app.agents.browser_agent.sync_playwright")
@patch("anthropic.Anthropic")
def test_start_url_not_called_if_not_provided(mock_anthropic, mock_sync_playwright):
    mock_context = MagicMock()
    mock_page = MagicMock()

    mock_sync_playwright.return_value.__enter__.return_value = mock_context
    mock_context.chromium.launch.return_value.new_page.return_value = mock_page

    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text="done")]

    mock_anthropic.return_value.messages.create.return_value = mock_response

    agent = BrowserAgent()
    agent.run({"task": "test"}, "input")

    mock_page.goto.assert_not_called()
