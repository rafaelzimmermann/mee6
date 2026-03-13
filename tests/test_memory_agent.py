"""Tests for MemoryAgentPlugin."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from unittest import mock

import pytest

from mee6.pipelines.models import PipelineStep
from mee6.pipelines.plugins.memory_agent import MemoryAgentPlugin
from mee6.db.models import PipelineMemoryRow


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_session():
    """Mock AsyncSessionLocal."""
    with patch("mee6.pipelines.plugins.memory_agent.AsyncSessionLocal") as mock:
        async_session = MagicMock()
        session = MagicMock()
        async_session.return_value.__aenter__.return_value = session
        session.execute = AsyncMock()
        session.__aenter__ = AsyncMock(return_value=session)
        session.__aexit__ = AsyncMock()
        mock.return_value = async_session
        yield mock, session


@pytest.fixture()
def mock_memory_repository():
    """Mock PipelineMemoryRepository."""
    with patch("mee6.pipelines.plugins.memory_agent.PipelineMemoryRepository") as mock:
        repo = MagicMock()
        repo.get_config = AsyncMock()
        repo.insert = AsyncMock()
        repo.get_recent = AsyncMock()
        mock.return_value = repo
        yield repo


@pytest.fixture()
def memory_agent():
    """MemoryAgentPlugin instance."""
    return MemoryAgentPlugin()


# ---------------------------------------------------------------------------
# get_fields
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_fields_returns_all_fields(memory_agent):
    """get_fields returns all 6 fields including read/write checkboxes."""
    with patch(
        "mee6.pipelines.plugins._options.load_memory_options",
        new_callable=AsyncMock,
        return_value=["label1", "label2"],
    ):
        fields = await memory_agent.get_fields()

    assert len(fields) == 6

    field_names = {f.name for f in fields}
    assert "read_memory" in field_names
    assert "write_memory" in field_names
    assert "memory_label" in field_names
    assert "max_memories" in field_names
    assert "ttl_hours" in field_names
    assert "max_value_size" in field_names

    # Check read_memory checkbox
    read_field = next(f for f in fields if f.name == "read_memory")
    assert read_field.field_type == "checkbox"
    assert read_field.required is False

    # Check write_memory checkbox
    write_field = next(f for f in fields if f.name == "write_memory")
    assert write_field.field_type == "checkbox"
    assert write_field.required is False

    # Check memory_label combobox
    label_field = next(f for f in fields if f.name == "memory_label")
    assert label_field.field_type == "combobox"
    assert label_field.required is True
    assert label_field.options == ["label1", "label2"]


# ---------------------------------------------------------------------------
# run - Write Memory
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_write_only(memory_agent, mock_memory_repository):
    """run with write_memory=True writes to database and returns input."""
    mock_memory_repository.get_config.return_value = {"max_value_size": 2000}

    result = await memory_agent.run(
        config={
            "write_memory": "on",
            "read_memory": "",
            "memory_label": "test_label",
            "max_memories": "20",
            "ttl_hours": "720",
            "max_value_size": "2000",
            "_pipeline_id": "pipe-1",
            "_trigger_id": "trigger-1",
        },
        input="test input data",
    )

    # Should return input unchanged (transparent node)
    assert result == "test input data"
    mock_memory_repository.insert.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_write_truncates_large_input(memory_agent, mock_memory_repository):
    """run truncates input if it exceeds max_value_size."""
    mock_memory_repository.get_config.return_value = {"max_value_size": 10}

    long_input = "x" * 100
    result = await memory_agent.run(
        config={
            "write_memory": "on",
            "read_memory": "",
            "memory_label": "test_label",
            "max_memories": "20",
            "ttl_hours": "720",
            "max_value_size": "10",
            "_pipeline_id": "pipe-1",
        },
        input=long_input,
    )

    # Input should be truncated to max_value_size
    assert len(result) == 10
    assert result == "xxxxxxxxxx"


# ---------------------------------------------------------------------------
# run - Read Memory
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_read_only(memory_agent, mock_memory_repository):
    """run with read_memory=True reads from database."""
    now = datetime.utcnow()
    memories = [
        PipelineMemoryRow(
            id=1,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now - timedelta(hours=1),
            value="memory 1",
        ),
        PipelineMemoryRow(
            id=2,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now - timedelta(hours=2),
            value="memory 2",
        ),
    ]
    mock_memory_repository.get_recent.return_value = memories

    result = await memory_agent.run(
        config={
            "write_memory": "",
            "read_memory": "on",
            "memory_label": "test_label",
            "max_memories": "20",
            "ttl_hours": "720",
            "max_value_size": "2000",
            "_pipeline_id": "pipe-1",
        },
        input="ignored for read",
    )

    assert "Memories for 'test_label':" in result
    assert "memory 1" in result
    assert "memory 2" in result
    mock_memory_repository.list.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_read_no_memories(memory_agent, mock_memory_repository):
    """run with read_memory=True returns message when no memories found."""
    mock_memory_repository.list.return_value = []

    result = await memory_agent.run(
        config={
            "write_memory": "",
            "read_memory": "on",
            "memory_label": "test_label",
            "max_memories": "20",
            "ttl_hours": "720",
            "max_value_size": "2000",
            "_pipeline_id": "pipe-1",
        },
        input="ignored",
    )

    assert result == "No memories found for label 'test_label' within the last 720 hours."


@pytest.mark.asyncio
async def test_run_read_respects_ttl(memory_agent, mock_memory_repository):
    """run with read_memory=True filters by TTL."""
    now = datetime.utcnow()

    # Recent memory within TTL (the mock should return only this)
    recent_memory = PipelineMemoryRow(
        id=2,
        pipeline_id="pipe-1",
        trigger_id=None,
        label="test_label",
        created_at=now - timedelta(hours=1),  # Within 24 hour TTL
        value="recent memory",
    )

    # Mock repository returns only recent memory (simulating TTL filtering)
    mock_memory_repository.list.return_value = [recent_memory]

    result = await memory_agent.run(
        config={
            "write_memory": "",
            "read_memory": "on",
            "memory_label": "test_label",
            "max_memories": "20",
            "ttl_hours": "24",  # 24 hour TTL
            "max_value_size": "2000",
            "_pipeline_id": "pipe-1",
        },
        input="ignored",
    )

    # Should only return recent memory
    assert "recent memory" in result

    # Verify cutoff time calculation
    call_args = mock_memory_repository.get_recent.call_args
    cutoff_time = call_args.kwargs["since"]
    expected_cutoff = now - timedelta(hours=24)
    # Allow small time difference due to execution
    assert abs((cutoff_time - expected_cutoff).total_seconds()) < 2


@pytest.mark.asyncio
async def test_run_read_respects_max_memories(memory_agent, mock_memory_repository):
    """run with read_memory=True limits returned memories."""
    now = datetime.utcnow()
    memories = [
        PipelineMemoryRow(
            id=i,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now - timedelta(hours=i),
            value=f"memory {i}",
        )
        for i in range(10)
    ]
    mock_memory_repository.get_recent.return_value = memories

    result = await memory_agent.run(
        config={
            "write_memory": "",
            "read_memory": "on",
            "memory_label": "test_label",
            "max_memories": "3",  # Only return 3 memories
            "ttl_hours": "720",
            "max_value_size": "2000",
            "_pipeline_id": "pipe-1",
        },
        input="ignored",
    )

    call_args = mock_memory_repository.get_recent.call_args
    assert call_args.kwargs["limit"] == 3


# ---------------------------------------------------------------------------
# run - Read and Write Both
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_write_then_read(memory_agent, mock_memory_repository):
    """run with both checkboxes writes first, then reads."""
    now = datetime.utcnow()
    existing_memory = PipelineMemoryRow(
        id=1,
        pipeline_id="pipe-1",
        trigger_id=None,
        label="test_label",
        created_at=now - timedelta(hours=1),
        value="existing",
    )
    mock_memory_repository.get_config.return_value = {"max_value_size": 2000}
    mock_memory_repository.get_recent.return_value = [existing_memory]

    result = await memory_agent.run(
        config={
            "write_memory": "on",
            "read_memory": "on",
            "memory_label": "test_label",
            "max_memories": "20",
            "ttl_hours": "720",
            "max_value_size": "2000",
            "_pipeline_id": "pipe-1",
        },
        input="new input to write",
    )

    # Should write first, then read (return memories)
    assert "new input to write" not in result  # Write happened but doesn't appear in output
    assert "Memories for 'test_label':" in result
    assert "existing" in result

    # Verify both operations happened
    mock_memory_repository.insert.assert_awaited_once()  # Write
    mock_memory_repository.list.assert_awaited_once()  # Read


# ---------------------------------------------------------------------------
# run - Validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_no_checkboxes_selected(memory_agent):
    """run returns error when neither checkbox is selected."""
    result = await memory_agent.run(
        config={
            "write_memory": "",
            "read_memory": "",
            "memory_label": "test_label",
            "max_memories": "20",
            "ttl_hours": "720",
            "max_value_size": "2000",
            "_pipeline_id": "pipe-1",
        },
        input="input",
    )

    assert "Error: Please select at least one of Read Memory or Write Memory." in result


# ---------------------------------------------------------------------------
# _read_memory
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_read_memory_formats_with_timestamps(memory_agent, mock_memory_repository):
    """_read_memory formats memories with ISO timestamps."""
    now = datetime(2026, 3, 13, 10, 0, 0)
    memory = PipelineMemoryRow(
        id=1,
        pipeline_id="pipe-1",
        trigger_id=None,
        label="test_label",
        created_at=now,
        value="test value",
    )
    mock_memory_repository.list.return_value = [memory]

    result = await memory_agent._read_memory(
        config={"_pipeline_id": "pipe-1"},
        label="test_label",
        ttl_hours=720,
        max_memories=20,
    )

    assert "2026-03-13T10:00:00" in result
    assert "test value" in result
