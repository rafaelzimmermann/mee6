def test_run_without_auth_returns_401(client):
    response = client.post(
        "/run",
        json={
            "agent_type": "llm_agent",
            "config": {"prompt": "test"},
            "input": "world",
        },
    )
    assert response.status_code == 401


def test_run_with_wrong_token_returns_401(client):
    response = client.post(
        "/run",
        json={
            "agent_type": "llm_agent",
            "config": {"prompt": "test"},
            "input": "world",
        },
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert response.status_code == 401


def test_run_with_unknown_agent_type_returns_422(client, auth_headers):
    response = client.post(
        "/run",
        json={
            "agent_type": "unknown_agent",
            "config": {"prompt": "test"},
            "input": "world",
        },
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert "Unknown agent_type" in response.json()["detail"]


def test_run_with_valid_llm_agent_returns_output(client, auth_headers, mocker):
    mock_message = mocker.Mock()
    mock_message.content = [mocker.Mock(text="Hello world!")]

    mock_client = mocker.patch("anthropic.Anthropic")
    mock_client.return_value.messages.create.return_value = mock_message

    response = client.post(
        "/run",
        json={
            "agent_type": "llm_agent",
            "config": {"prompt": "Say hi to {input}"},
            "input": "world",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json() == {"output": "Hello world!"}


def test_run_with_valid_llm_agent_calls_anthropic_with_resolved_prompt(
    client, auth_headers, mocker
):
    mock_message = mocker.Mock()
    mock_message.content = [mocker.Mock(text="test")]

    mock_client = mocker.patch("anthropic.Anthropic")
    mock_client.return_value.messages.create.return_value = mock_message

    response = client.post(
        "/run",
        json={
            "agent_type": "llm_agent",
            "config": {"prompt": "Say hi to {input}"},
            "input": "world",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200

    mock_client.return_value.messages.create.assert_called_once()
    call_args = mock_client.return_value.messages.create.call_args
    assert call_args.kwargs["messages"][0]["content"] == "Say hi to world"
