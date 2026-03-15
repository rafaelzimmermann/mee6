def test_schema_returns_200(client):
    response = client.get("/schema")
    assert response.status_code == 200


def test_schema_has_all_agent_types(client):
    response = client.get("/schema")
    assert response.status_code == 200
    data = response.json()
    assert "llm_agent" in data
    assert "browser_agent" in data
    assert "calendar_agent" in data


def test_each_agent_has_label_and_fields(client):
    response = client.get("/schema")
    assert response.status_code == 200
    data = response.json()

    for agent_name, agent_schema in data.items():
        assert "label" in agent_schema
        assert isinstance(agent_schema["label"], str)
        assert len(agent_schema["label"]) > 0

        assert "fields" in agent_schema
        assert isinstance(agent_schema["fields"], list)
        assert len(agent_schema["fields"]) > 0


def test_each_field_has_required_properties(client):
    response = client.get("/schema")
    assert response.status_code == 200
    data = response.json()

    for agent_name, agent_schema in data.items():
        for field in agent_schema["fields"]:
            assert "name" in field
            assert isinstance(field["name"], str)
            assert len(field["name"]) > 0

            assert "label" in field
            assert isinstance(field["label"], str)
            assert len(field["label"]) > 0

            assert "field_type" in field
            assert isinstance(field["field_type"], str)
            assert len(field["field_type"]) > 0

            assert "required" in field
            assert isinstance(field["required"], bool)


def test_llm_agent_has_prompt_textarea_field(client):
    response = client.get("/schema")
    assert response.status_code == 200
    data = response.json()

    llm_fields = data["llm_agent"]["fields"]
    prompt_field = next((f for f in llm_fields if f["name"] == "prompt"), None)
    assert prompt_field is not None
    assert prompt_field["field_type"] == "textarea"


def test_calendar_agent_has_calendar_id_field(client):
    response = client.get("/schema")
    assert response.status_code == 200
    data = response.json()

    calendar_fields = data["calendar_agent"]["fields"]
    calendar_id_field = next(
        (f for f in calendar_fields if f["name"] == "calendar_id"), None
    )
    assert calendar_id_field is not None
    assert calendar_id_field["field_type"] == "calendar_select"
