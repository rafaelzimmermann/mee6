from app.agents.llm_agent import LlmAgent


def test_llm_agent_schema_has_correct_fields():
    agent = LlmAgent()
    schema = agent.schema()

    assert schema["label"] == "LLM Agent"

    field_names = [f["name"] for f in schema["fields"]]
    assert "provider" in field_names
    assert "model" in field_names
    assert "prompt" in field_names
    assert "system_prompt" in field_names

    provider_field = next(f for f in schema["fields"] if f["name"] == "provider")
    assert provider_field["field_type"] == "select"
    assert "anthropic" in provider_field["options"]
    assert "ollama" in provider_field["options"]

    model_field = next(f for f in schema["fields"] if f["name"] == "model")
    assert model_field["field_type"] == "model_select"

    prompt_field = next(f for f in schema["fields"] if f["name"] == "prompt")
    assert prompt_field["field_type"] == "textarea"
    assert prompt_field["required"] is True

    system_prompt_field = next(
        f for f in schema["fields"] if f["name"] == "system_prompt"
    )
    assert system_prompt_field["field_type"] == "textarea"
    assert system_prompt_field["required"] is False


def test_input_placeholder_replaced_in_prompt(mocker):
    mock_message = mocker.Mock()
    mock_message.content = [mocker.Mock(text="test response")]

    mock_client = mocker.patch("anthropic.Anthropic")
    mock_client.return_value.messages.create.return_value = mock_message

    agent = LlmAgent()
    output = agent.run({"prompt": "Say hi to {input}"}, "world")

    assert output == "test response"
    call_args = mock_client.return_value.messages.create.call_args
    assert call_args.kwargs["messages"][0]["content"] == "Say hi to world"


def test_input_placeholder_replaced_in_system_prompt(mocker):
    mock_message = mocker.Mock()
    mock_message.content = [mocker.Mock(text="test response")]

    mock_client = mocker.patch("anthropic.Anthropic")
    mock_client.return_value.messages.create.return_value = mock_message

    agent = LlmAgent()
    output = agent.run({"prompt": "Hello", "system_prompt": "User is {input}"}, "John")

    assert output == "test response"
    call_args = mock_client.return_value.messages.create.call_args
    assert call_args.kwargs["system"] == "User is John"


def test_anthropic_messages_create_called_once(mocker):
    mock_message = mocker.Mock()
    mock_message.content = [mocker.Mock(text="test")]

    mock_client = mocker.patch("anthropic.Anthropic")
    mock_client.return_value.messages.create.return_value = mock_message

    agent = LlmAgent()
    agent.run({"prompt": "test"}, "input")

    mock_client.return_value.messages.create.assert_called_once()


def test_response_text_returned_as_output(mocker):
    mock_message = mocker.Mock()
    mock_message.content = [mocker.Mock(text="This is the output")]

    mock_client = mocker.patch("anthropic.Anthropic")
    mock_client.return_value.messages.create.return_value = mock_message

    agent = LlmAgent()
    output = agent.run({"prompt": "test"}, "input")

    assert output == "This is the output"


def test_missing_prompt_key_uses_empty_string(mocker):
    mock_message = mocker.Mock()
    mock_message.content = [mocker.Mock(text="response")]

    mock_client = mocker.patch("anthropic.Anthropic")
    mock_client.return_value.messages.create.return_value = mock_message

    agent = LlmAgent()
    output = agent.run({}, "input")

    assert output == "response"
    call_args = mock_client.return_value.messages.create.call_args
    assert call_args.kwargs["messages"][0]["content"] == ""


def test_ollama_provider_calls_httpx(mocker):
    mock_post = mocker.patch("httpx.post")
    mock_post.return_value.json.return_value = {"message": {"content": "ollama response"}}

    agent = LlmAgent()
    output = agent.run({"provider": "ollama", "model": "llama3", "prompt": "Hello"}, "")

    assert output == "ollama response"
    mock_post.assert_called_once()
    call_kwargs = mock_post.call_args.kwargs
    assert call_kwargs["json"]["model"] == "llama3"
    assert call_kwargs["json"]["messages"][-1]["content"] == "Hello"


def test_ollama_includes_system_prompt(mocker):
    mock_post = mocker.patch("httpx.post")
    mock_post.return_value.json.return_value = {"message": {"content": "ok"}}

    agent = LlmAgent()
    agent.run({"provider": "ollama", "model": "llama3", "prompt": "Hi", "system_prompt": "Be brief"}, "")

    messages = mock_post.call_args.kwargs["json"]["messages"]
    assert messages[0] == {"role": "system", "content": "Be brief"}
    assert messages[1] == {"role": "user", "content": "Hi"}


def test_anthropic_provider_explicit(mocker):
    mock_message = mocker.Mock()
    mock_message.content = [mocker.Mock(text="anthropic response")]
    mock_client = mocker.patch("anthropic.Anthropic")
    mock_client.return_value.messages.create.return_value = mock_message

    agent = LlmAgent()
    output = agent.run({"provider": "anthropic", "model": "claude-opus-4-6", "prompt": "Hi"}, "")

    assert output == "anthropic response"
    call_kwargs = mock_client.return_value.messages.create.call_args.kwargs
    assert call_kwargs["model"] == "claude-opus-4-6"
