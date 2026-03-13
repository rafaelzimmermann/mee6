"""Tests for repository layer."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select, delete, func

from mee6.db.models import PipelineMemoryRow, PipelineMemoryConfig
from mee6.db.repository import PipelineMemoryRepository


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
    """PipelineMemoryRepository instance."""
    return PipelineMemoryRepository(mock_session)


# ---------------------------------------------------------------------------
# PipelineMemoryRepository - insert
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_insert_memory(memory_repository, mock_session):
    """insert adds a memory row to the database."""
    memory = PipelineMemoryRow(
        id=None,  # Will be set by database
        pipeline_id="pipe-1",
        trigger_id="trigger-1",
        label="test_label",
        created_at=datetime.utcnow(),
        value="test value",
    )

    await memory_repository.insert(memory)

    # Verify session.add was called
    mock_session.add.assert_called_once_with(memory)
    mock_session.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# PipelineMemoryRepository - get_recent (list)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_get_recent_all(memory_repository, mock_session):
    """get_recent returns all memories for a pipeline and label."""
    now = datetime.utcnow()
    mock_scalars = MagicMock()
    mock_scalars.all = MagicMock(return_value=[
        PipelineMemoryRow(
            id=1,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now,
            value="value1",
        ),
        PipelineMemoryRow(
            id=2,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now - timedelta(hours=1),
            value="value2",
        ),
    ])
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=mock_scalars)
    mock_session.execute.return_value = mock_result

    memories = await memory_repository.get_recent(
        pipeline_id="pipe-1", label="test_label", limit=10
    )

    assert len(memories) == 2
    assert memories[0].value == "value1"  # Most recent first after reverse
    assert memories[1].value == "value2"


@pytest.mark.asyncio
async def test_repository_get_recent_with_since(memory_repository, mock_session):
    """get_recent filters memories by since timestamp."""
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=24)
    mock_scalars_result = MagicMock()
    mock_scalars_result.all = MagicMock(return_value=[
        PipelineMemoryRow(
            id=1,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now - timedelta(hours=1),  # Within cutoff
            value="recent",
        ),
    ])
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=mock_scalars_result)
    mock_session.execute.return_value = mock_result

    memories = await memory_repository.get_recent(
        pipeline_id="pipe-1",
        label="test_label",
        limit=10,
        since=cutoff,
    )

    assert len(memories) == 1
    assert memories[0].value == "recent"


@pytest.mark.asyncio
async def test_repository_get_recent_with_limit(memory_repository, mock_session):
    """get_recent limits returned memories."""
    now = datetime.utcnow()
    mock_scalars_result = MagicMock()
    mock_scalars_result.all = MagicMock(return_value=[
        PipelineMemoryRow(
            id=i,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now,
            value=f"value{i}",
        )
        for i in range(3)  # Only 3 returned despite having more
    ])
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=mock_scalars_result)
    mock_session.execute.return_value = mock_result

    memories = await memory_repository.get_recent(
        pipeline_id="pipe-1", label="test_label", limit=3
    )

    assert len(memories) == 3


@pytest.mark.asyncio
async def test_repository_get_recent_ordered_by_created_at(memory_repository, mock_session):
    """get_recent returns memories ordered by created_at DESC, then reversed."""
    now = datetime.utcnow()
    mock_result = MagicMock()
    mock_scalars_result = MagicMock()
    # Returns in DESC order (newest first)
    mock_scalars.all = MagicMock(return_value=[
        PipelineMemoryRow(
            id=3,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now,  # Most recent
            value="value3",
        ),
        PipelineMemoryRow(
            id=2,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now - timedelta(hours=1),
            value="value2",
        ),
        PipelineMemoryRow(
            id=1,
            pipeline_id="pipe-1",
            trigger_id=None,
            label="test_label",
            created_at=now - timedelta(hours=2),
            value="value1",
        ),
    ])
    mock_result.scalars = MagicMock(return_value=mock_scalars_result)
    mock_session.execute.return_value = mock_result

    memories = await memory_repository.get_recent(
        pipeline_id="pipe-1", label="test_label", limit=10
    )

    assert len(memories) == 3
    # After reverse(), should be oldest first
    assert memories[0].id == 1
    assert memories[1].id == 2
    assert memories[2].id == 3


# ---------------------------------------------------------------------------
# PipelineMemoryRepository - get_config
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_get_config(memory_repository, mock_session):
    """get_config returns memory configuration for a label."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=PipelineMemoryConfig(
        label="test_label",
        max_memories=50,
        ttl_hours=1440,
        max_value_size=5000,
    ))
    mock_session.execute.return_value = mock_result

    config = await memory_repository.get_config("test_label")

    assert config["label"] == "test_label"
    assert config["max_memories"] == 50
    assert config["ttl_hours"] == 1440
    assert config["max_value_size"] == 5000


@pytest.mark.asyncio
async def test_repository_get_config_not_found(memory_repository, mock_session):
    """get_config returns default config when label not found."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    mock_session.execute.return_value = mock_result

    config = await memory_repository.get_config("nonexistent_label")

    # Should return default config
    assert config["max_memories"] == 20
    assert config["ttl_hours"] == 720
    assert config["max_value_size"] == 2000


# ---------------------------------------------------------------------------
# PipelineMemoryRepository - delete_oldest (trim_to_max)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_delete_oldest(memory_repository, mock_session):
    """delete_oldest keeps only the most recent N memories."""
    mock_result = MagicMock()
    mock_result.rowcount = 5  # Deleted 5 old memories
    mock_session.execute.return_value = mock_result

    await memory_repository.delete_oldest(
        pipeline_id="pipe-1", label="test_label", keep=20
    )

    # Verify DELETE was called
    mock_session.execute.assert_awaited_once()
    mock_session.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# PipelineMemoryRepository - delete_expired (cleanup_old_memories)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_delete_expired(memory_repository, mock_session):
    """delete_expired deletes memories older than cutoff."""
    cutoff = datetime.utcnow() - timedelta(hours=720)
    mock_result = MagicMock()
    mock_session.execute.return_value = mock_result

    await memory_repository.delete_expired(
        pipeline_id="pipe-1", label="test_label", before=cutoff
    )

    # Verify session.execute was called
    mock_session.execute.assert_awaited_once()
    mock_session.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# PipelineMemoryRepository - count
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_repository_count(memory_repository, mock_session):
    """count returns the count of memories for a label."""
    mock_result = MagicMock()
    mock_result.scalar_one = MagicMock(return_value=42)
    mock_session.execute.return_value = mock_result

    count = await memory_repository.count(
        pipeline_id="pipe-1", label="test_label"
    )

    assert count == 42
    mock_session.execute.assert_awaited_once()
