"""Tests for MemoryAgentPlugin."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from unittest import mock

import pytest

from mee6.pipelines.plugins.memory_agent import MemoryAgentPlugin
from mee6.db.models import MemoryEntryRow, MemoryRow


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_memory_repository():
    """Mock MemoryRepository and AsyncSessionLocal together.

    Patches AsyncSessionLocal in mee6.db.engine (where it is defined and where
    memory_agent's lazy import resolves to) and MemoryRepository in
    mee6.db.repository so that each call to MemoryRepository(session) returns
    our mock repo object.
    """
    repo = MagicMock()
    repo.get_config = AsyncMock()
    repo.insert_entry = AsyncMock()
    repo.delete_oldest_entries = AsyncMock()

    # Build a minimal async context manager
    session_mock = MagicMock()
    async_ctx = MagicMock()
    async_ctx.__aenter__ = AsyncMock(return_value=session_mock)
    async_ctx.__aexit__ = AsyncMock(return_value=False)

    with patch("mee6.db.engine.AsyncSessionLocal", return_value=async_ctx), \
         patch("mee6.db.repository.MemoryRepository", return_value=repo):
        yield repo


@pytest.fixture()
def memory_agent():
    """MemoryAgentPlugin instance."""
    return MemoryAgentPlugin()


# ---------------------------------------------------------------------------
# get_fields
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_fields_returns_one_field(memory_agent):
    """get_fields returns exactly 1 field: memory_label."""
    with patch(
        "mee6.pipelines.plugins._options.load_memory_options",
        new_callable=AsyncMock,
        return_value=["label1", "label2"],
    ):
        fields = await memory_agent.get_fields()

    assert len(fields) == 1
    field = fields[0]
    assert field.name == "memory_label"
    assert field.field_type == "select"
    assert field.required is True
    assert field.options == ["label1", "label2"]


# ---------------------------------------------------------------------------
# run - Write Memory
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_write_returns_input_unchanged(memory_agent, mock_memory_repository):
    """run writes to DB and returns input unchanged (transparent pass-through)."""
    import uuid
    mem_config = MemoryRow(
        id=str(uuid.uuid4()),
        label="test_label",
        max_memories=20,
        ttl_hours=720,
        max_value_size=2000,
    )
    mock_memory_repository.get_config.return_value = mem_config

    result = await memory_agent.run(
        config={"memory_label": "test_label"},
        input="test input data",
    )

    assert result == "test input data"
    mock_memory_repository.insert_entry.assert_awaited_once()
    mock_memory_repository.delete_oldest_entries.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_no_label_raises_value_error(memory_agent):
    """run raises ValueError when memory_label is not configured."""
    with pytest.raises(ValueError, match="no memory_label configured"):
        await memory_agent.run(config={"memory_label": ""}, input="some input")


@pytest.mark.asyncio
async def test_run_label_not_found_raises_value_error(memory_agent, mock_memory_repository):
    """run raises ValueError when label is not found in config."""
    mock_memory_repository.get_config.return_value = None

    with pytest.raises(ValueError, match="is not configured"):
        await memory_agent.run(
            config={"memory_label": "missing_label"},
            input="some input",
        )


@pytest.mark.asyncio
async def test_run_truncates_large_input(memory_agent, mock_memory_repository):
    """run truncates input to max_value_size before storing."""
    import uuid
    mem_config = MemoryRow(
        id=str(uuid.uuid4()),
        label="test_label",
        max_memories=20,
        ttl_hours=720,
        max_value_size=10,
    )
    mock_memory_repository.get_config.return_value = mem_config

    long_input = "x" * 100
    result = await memory_agent.run(
        config={"memory_label": "test_label"},
        input=long_input,
    )

    # Return value is original input (pass-through), not truncated
    assert result == long_input

    # But the stored value should be truncated
    inserted_entry = mock_memory_repository.insert_entry.call_args[0][0]
    assert len(inserted_entry.value) == 10
    assert inserted_entry.value == "xxxxxxxxxx"


@pytest.mark.asyncio
async def test_run_calls_delete_oldest_after_insert(memory_agent, mock_memory_repository):
    """run calls delete_oldest_entries with correct memory_id and keep count."""
    import uuid
    mem_id = str(uuid.uuid4())
    mem_config = MemoryRow(
        id=mem_id,
        label="test_label",
        max_memories=5,
        ttl_hours=720,
        max_value_size=2000,
    )
    mock_memory_repository.get_config.return_value = mem_config

    await memory_agent.run(
        config={"memory_label": "test_label"},
        input="some input",
    )

    mock_memory_repository.delete_oldest_entries.assert_awaited_once_with(
        memory_id=mem_id,
        keep=5,
    )


@pytest.mark.asyncio
async def test_run_insert_entry_uses_memory_id(memory_agent, mock_memory_repository):
    """run inserts MemoryEntryRow with correct memory_id."""
    import uuid
    mem_id = str(uuid.uuid4())
    mem_config = MemoryRow(
        id=mem_id,
        label="test_label",
        max_memories=20,
        ttl_hours=720,
        max_value_size=2000,
    )
    mock_memory_repository.get_config.return_value = mem_config

    await memory_agent.run(
        config={"memory_label": "test_label"},
        input="hello",
    )

    inserted_entry = mock_memory_repository.insert_entry.call_args[0][0]
    assert isinstance(inserted_entry, MemoryEntryRow)
    assert inserted_entry.memory_id == mem_id
    assert inserted_entry.value == "hello"
