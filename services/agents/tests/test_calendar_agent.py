from unittest.mock import MagicMock
from app.agents.calendar_agent import CalendarAgent


def test_calendar_agent_schema_has_correct_fields():
    agent = CalendarAgent()
    schema = agent.schema()

    assert schema["label"] == "Calendar Agent"
    assert len(schema["fields"]) == 3

    task_field = next(f for f in schema["fields"] if f["name"] == "task")
    assert task_field["field_type"] == "textarea"
    assert task_field["required"] is True

    calendar_id_field = next(f for f in schema["fields"] if f["name"] == "calendar_id")
    assert calendar_id_field["field_type"] == "calendar_select"
    assert calendar_id_field["required"] is True

    credentials_file_field = next(
        f for f in schema["fields"] if f["name"] == "credentials_file"
    )
    assert credentials_file_field["field_type"] == "text"
    assert credentials_file_field["required"] is True


def test_tool_use_loop_terminates_on_end_turn(mocker):
    mock_creds = mocker.patch("app.agents.calendar_agent.Credentials")
    mock_creds.from_authorized_user_file.return_value = MagicMock()

    mock_service = mocker.patch("app.agents.calendar_agent.build").return_value

    mock_response = mocker.Mock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [mocker.Mock(text="Calendar task completed")]

    mock_anthropic = mocker.patch("anthropic.Anthropic")
    mock_anthropic.return_value.messages.create.return_value = mock_response

    agent = CalendarAgent()
    output = agent.run(
        {
            "task": "List events",
            "calendar_id": "primary",
            "credentials_file": "/path/to/creds.json",
        },
        "input",
    )

    assert output == "Calendar task completed"


def test_execute_tool_list_events(mocker):
    mock_service = MagicMock()
    mock_events = MagicMock()
    mock_service.events.return_value = mock_events

    mock_result = {"items": [{"summary": "Test Event"}]}
    mock_events.list.return_value.execute.return_value = mock_result

    agent = CalendarAgent()
    result = agent._execute_tool(
        mock_service,
        "primary",
        "list_events",
        {
            "time_min": "2024-01-01T00:00:00Z",
            "time_max": "2024-01-31T23:59:59Z",
            "max_results": 10,
        },
    )

    assert result == [{"summary": "Test Event"}]
    mock_events.list.assert_called_once_with(
        calendarId="primary",
        timeMin="2024-01-01T00:00:00Z",
        timeMax="2024-01-31T23:59:59Z",
        maxResults=10,
        singleEvents=True,
        orderBy="startTime",
    )

    assert result == [{"summary": "Test Event"}]


def test_execute_tool_create_event(mocker):
    mock_service = MagicMock()
    mock_events = MagicMock()
    mock_service.events.return_value = mock_events

    mock_result = {"id": "event123"}
    mock_events.insert.return_value.execute.return_value = mock_result

    agent = CalendarAgent()
    result = agent._execute_tool(
        mock_service,
        "primary",
        "create_event",
        {
            "summary": "Test Event",
            "start": "2024-01-01T10:00:00Z",
            "end": "2024-01-01T11:00:00Z",
            "description": "Test description",
        },
    )

    assert result == {"id": "event123"}
    mock_events.insert.assert_called_once()
    call_kwargs = mock_events.insert.call_args.kwargs
    assert call_kwargs["calendarId"] == "primary"
    assert call_kwargs["body"]["summary"] == "Test Event"
    assert call_kwargs["body"]["start"]["dateTime"] == "2024-01-01T10:00:00Z"
    assert call_kwargs["body"]["end"]["dateTime"] == "2024-01-01T11:00:00Z"
    assert call_kwargs["body"]["description"] == "Test description"


def test_execute_tool_delete_event(mocker):
    mock_service = MagicMock()
    mock_events = MagicMock()
    mock_service.events.return_value = mock_events

    agent = CalendarAgent()
    result = agent._execute_tool(
        mock_service,
        "primary",
        "delete_event",
        {
            "event_id": "event123",
        },
    )

    assert result == {"deleted": True}
    mock_events.delete.assert_called_once_with(
        calendarId="primary",
        eventId="event123",
    )


def test_execute_tool_unknown_tool_raises_value_error():
    agent = CalendarAgent()
    mock_service = MagicMock()

    try:
        agent._execute_tool(mock_service, "primary", "unknown_tool", {})
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "Unknown tool: unknown_tool" in str(e)


def test_loop_respects_10_iteration_cap(mocker):
    mock_creds = mocker.patch("app.agents.calendar_agent.Credentials")
    mock_creds.from_authorized_user_file.return_value = MagicMock()

    mock_service = mocker.patch("app.agents.calendar_agent.build").return_value
    mock_events = MagicMock()
    mock_service.events.return_value = mock_events

    mock_response = mocker.Mock()
    mock_response.stop_reason = "tool_use"
    mock_tool = mocker.Mock()
    mock_tool.type = "tool_use"
    mock_tool.name = "list_events"
    mock_tool.input = {
        "time_min": "2024-01-01T00:00:00Z",
        "time_max": "2024-01-31T23:59:59Z",
        "max_results": 10,
    }
    mock_tool.id = "test"
    mock_response.content = [mock_tool]

    mock_events.list.return_value.execute.return_value.get.return_value = []

    mock_anthropic = mocker.patch("anthropic.Anthropic")
    mock_anthropic.return_value.messages.create.return_value = mock_response

    agent = CalendarAgent()
    output = agent.run(
        {
            "task": "List events",
            "calendar_id": "primary",
            "credentials_file": "/path/to/creds.json",
        },
        "input",
    )

    assert output == "Max iterations reached without a final response."
    assert mock_anthropic.return_value.messages.create.call_count == 10
