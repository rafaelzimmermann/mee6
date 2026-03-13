"""Tests for repository layer."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select, delete, func

from mee6.db.models import MemoryEntryRow, MemoryRow, PipelineStepRow
from mee6.db.repository import MemoryRepository, PipelineStepRepository


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_session():
    """Mock AsyncSession for repository tests."""
    session = MagicMock()
    session.add = MagicMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock()
    yield session


@pytest.fixture()
def memory_repository(mock_session):
    """MemoryRepository instance."""
    return MemoryRepository(mock_session)


# ---------------------------------------------------------------------------
# MemoryRepository - get_config
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_get_config(memory_repository, mock_session):
    """get_config returns MemoryRow for a label."""
    import uuid
    row_id = str(uuid.uuid4())
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=MemoryRow(
        id=row_id,
        label="test_label",
        max_memories=50,
        ttl_hours=1440,
        max_value_size=5000,
    ))
    mock_session.execute.return_value = mock_result

    config = await memory_repository.get_config("test_label")

    assert config is not None
    assert config.label == "test_label"
    assert config.max_memories == 50
    assert config.ttl_hours == 1440
    assert config.max_value_size == 5000


@pytest.mark.asyncio
async def test_repository_get_config_not_found(memory_repository, mock_session):
    """get_config returns None when label not found."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    mock_session.execute.return_value = mock_result

    config = await memory_repository.get_config("nonexistent_label")

    assert config is None


# ---------------------------------------------------------------------------
# MemoryRepository - list_configs
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_list_configs(memory_repository, mock_session):
    """list_configs returns list of MemoryRow objects."""
    import uuid
    rows = [
        MemoryRow(id=str(uuid.uuid4()), label="alpha", max_memories=10, ttl_hours=100, max_value_size=500),
        MemoryRow(id=str(uuid.uuid4()), label="beta", max_memories=20, ttl_hours=200, max_value_size=1000),
    ]
    mock_result = MagicMock()
    mock_result.scalars.return_value = rows
    mock_session.execute.return_value = mock_result

    configs = await memory_repository.list_configs()

    assert len(configs) == 2
    assert configs[0].label == "alpha"
    assert configs[1].label == "beta"


# ---------------------------------------------------------------------------
# MemoryRepository - set_config (create new)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_set_config_creates_new(memory_repository, mock_session):
    """set_config creates a new MemoryRow when label does not exist."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    mock_session.execute.return_value = mock_result

    await memory_repository.set_config(
        label="new_label",
        max_memories=30,
        ttl_hours=360,
        max_value_size=1500,
    )

    mock_session.add.assert_called_once()
    added_row = mock_session.add.call_args[0][0]
    assert added_row.label == "new_label"
    assert added_row.max_memories == 30
    assert added_row.ttl_hours == 360
    assert added_row.max_value_size == 1500
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_repository_set_config_updates_existing(memory_repository, mock_session):
    """set_config updates an existing MemoryRow."""
    import uuid
    existing = MemoryRow(
        id=str(uuid.uuid4()),
        label="existing_label",
        max_memories=10,
        ttl_hours=100,
        max_value_size=500,
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=existing)
    mock_session.execute.return_value = mock_result

    await memory_repository.set_config(
        label="existing_label",
        max_memories=99,
        ttl_hours=999,
        max_value_size=9999,
    )

    assert existing.max_memories == 99
    assert existing.ttl_hours == 999
    assert existing.max_value_size == 9999
    mock_session.add.assert_not_called()
    mock_session.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# MemoryRepository - delete_config
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_delete_config(memory_repository, mock_session):
    """delete_config executes a delete and commits."""
    mock_result = MagicMock()
    mock_session.execute.return_value = mock_result

    await memory_repository.delete_config("test_label")

    mock_session.execute.assert_awaited_once()
    mock_session.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# MemoryRepository - get_entries_by_label
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_get_entries_by_label(memory_repository, mock_session):
    """get_entries_by_label returns entries for a label ordered by created_at asc."""
    import uuid
    now = datetime.utcnow()
    mem_id = str(uuid.uuid4())
    entries = [
        MemoryEntryRow(id=1, memory_id=mem_id, created_at=now - timedelta(hours=2), value="old"),
        MemoryEntryRow(id=2, memory_id=mem_id, created_at=now - timedelta(hours=1), value="new"),
    ]
    mock_result = MagicMock()
    mock_result.scalars.return_value = entries
    mock_session.execute.return_value = mock_result

    result = await memory_repository.get_entries_by_label("test_label")

    assert len(result) == 2
    assert result[0].value == "old"
    assert result[1].value == "new"
    mock_session.execute.assert_awaited_once()


# ---------------------------------------------------------------------------
# MemoryRepository - insert_entry
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_insert_entry(memory_repository, mock_session):
    """insert_entry adds an entry to the session and commits."""
    import uuid
    entry = MemoryEntryRow(
        memory_id=str(uuid.uuid4()),
        created_at=datetime.utcnow(),
        value="test value",
    )

    await memory_repository.insert_entry(entry)

    mock_session.add.assert_called_once_with(entry)
    mock_session.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# MemoryRepository - count_entries
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_count_entries(memory_repository, mock_session):
    """count_entries returns the count of entries for a memory_id."""
    mock_result = MagicMock()
    mock_result.scalar_one = MagicMock(return_value=7)
    mock_session.execute.return_value = mock_result

    count = await memory_repository.count_entries("some-uuid")

    assert count == 7
    mock_session.execute.assert_awaited_once()


# ---------------------------------------------------------------------------
# MemoryRepository - delete_oldest_entries
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_delete_oldest_entries(memory_repository, mock_session):
    """delete_oldest_entries executes a delete and commits."""
    mock_result = MagicMock()
    mock_session.execute.return_value = mock_result

    await memory_repository.delete_oldest_entries("some-uuid", keep=5)

    mock_session.execute.assert_awaited_once()
    mock_session.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# PipelineStepRepository
# ---------------------------------------------------------------------------


@pytest.fixture()
def step_repository(mock_session):
    return PipelineStepRepository(mock_session)


@pytest.mark.asyncio
async def test_step_repository_list_by_pipeline(step_repository, mock_session):
    """list_by_pipeline returns steps ordered by step_index."""
    mock_result = MagicMock()
    mock_result.scalars.return_value = [
        PipelineStepRow(id=1, pipeline_id="pipe-1", step_index=0, agent_type="llm_agent", config={"prompt": "hi"}),
        PipelineStepRow(id=2, pipeline_id="pipe-1", step_index=1, agent_type="browser_agent", config={"task": "go"}),
    ]
    mock_session.execute.return_value = mock_result

    steps = await step_repository.list_by_pipeline("pipe-1")

    assert len(steps) == 2
    assert steps[0].agent_type == "llm_agent"
    assert steps[1].agent_type == "browser_agent"


@pytest.mark.asyncio
async def test_step_repository_upsert_steps_deletes_then_inserts(step_repository, mock_session):
    """upsert_steps deletes existing steps and inserts new ones."""
    step_rows = [
        PipelineStepRow(pipeline_id="pipe-1", step_index=0, agent_type="llm_agent", config={"prompt": "hi"}),
    ]

    await step_repository.upsert_steps("pipe-1", step_rows)

    # DELETE then INSERT (execute called once for delete, add called for each step)
    mock_session.execute.assert_awaited_once()
    mock_session.add.assert_called_once_with(step_rows[0])
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_step_repository_upsert_steps_empty_clears_steps(step_repository, mock_session):
    """upsert_steps with empty list deletes all steps."""
    await step_repository.upsert_steps("pipe-1", [])

    mock_session.execute.assert_awaited_once()
    mock_session.add.assert_not_called()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_step_repository_delete_by_pipeline(step_repository, mock_session):
    """delete_by_pipeline removes all steps for the given pipeline."""
    await step_repository.delete_by_pipeline("pipe-1")

    mock_session.execute.assert_awaited_once()
    mock_session.commit.assert_awaited_once()
