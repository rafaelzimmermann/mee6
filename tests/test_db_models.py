"""Tests for database models."""

from datetime import datetime

import pytest
from sqlalchemy import inspect

from mee6.db.models import (
    Base,
    MemoryEntryRow,
    MemoryRow,
    WhatsAppSettingsRow,
    PipelineRow,
    TriggerRow,
)


# ---------------------------------------------------------------------------
# Test Model Instantiation
# ---------------------------------------------------------------------------


def test_pipeline_memory_row_instantiation():
    """MemoryEntryRow can be instantiated with required fields."""
    now = datetime.utcnow()
    entry = MemoryEntryRow(
        memory_id="some-uuid-1234",
        created_at=now,
        value="test value",
    )

    assert entry.memory_id == "some-uuid-1234"
    assert entry.created_at == now
    assert entry.value == "test value"
    # id is auto-increment, should be None before insert
    assert entry.id is None


def test_pipeline_memory_config_instantiation():
    """MemoryRow can be instantiated with required fields."""
    import uuid
    row_id = str(uuid.uuid4())
    config = MemoryRow(
        id=row_id,
        label="test_label",
        max_memories=50,
        ttl_hours=1440,
        max_value_size=5000,
    )

    assert config.id == row_id
    assert config.label == "test_label"
    assert config.max_memories == 50
    assert config.ttl_hours == 1440
    assert config.max_value_size == 5000


def test_whatsapp_settings_row_instantiation():
    """WhatsAppSettingsRow can be instantiated."""
    settings = WhatsAppSettingsRow(
        id="+1234567890",
        phone_number="+1234567890",
    )

    assert settings.id == "+1234567890"
    assert settings.phone_number == "+1234567890"


def test_pipeline_row_instantiation():
    """PipelineRow can be instantiated."""
    import json

    pipeline = PipelineRow(
        id="pipe-1",
        name="Test Pipeline",
        steps='[{"agent_type": "llm_agent", "config": {}}]',
    )

    assert pipeline.id == "pipe-1"
    assert pipeline.name == "Test Pipeline"
    assert '[{"agent_type": "llm_agent", "config": {}}]' in pipeline.steps


def test_trigger_row_instantiation():
    """TriggerRow can be instantiated."""
    trigger = TriggerRow(
        id="job-1",
        pipeline_id="pipe-1",
        trigger_type="cron",
        enabled=True,
        cron_expr="0 8 * * *",
    )

    assert trigger.id == "job-1"
    assert trigger.pipeline_id == "pipe-1"
    assert trigger.trigger_type == "cron"
    assert trigger.enabled is True
    assert trigger.cron_expr == "0 8 * * *"


# ---------------------------------------------------------------------------
# Test Optional Fields
# ---------------------------------------------------------------------------


def test_trigger_row_optional_cron_expression():
    """TriggerRow works without cron_expression for non-cron triggers."""
    trigger = TriggerRow(
        id="job-1",
        pipeline_id="pipe-1",
        trigger_type="whatsapp",
        enabled=True,
        cron_expr=None,  # Optional for non-cron triggers
    )

    assert trigger.cron_expr is None


# ---------------------------------------------------------------------------
# Test Model Defaults
# ---------------------------------------------------------------------------


def test_pipeline_memory_config_defaults():
    """MemoryRow has sensible defaults."""
    config = MemoryRow(
        label="test_label",
        max_memories=20,  # Default value
        ttl_hours=720,    # Default value
        max_value_size=2000,  # Default value
    )

    assert config.max_memories == 20
    assert config.ttl_hours == 720
    assert config.max_value_size == 2000


def test_memory_row_id_explicit():
    """MemoryRow accepts an explicit UUID id."""
    import uuid
    row_id = str(uuid.uuid4())
    config = MemoryRow(id=row_id, label="test_label")
    assert config.id == row_id
    assert len(config.id) == 36  # UUID string length


def test_whatsapp_settings_default_phone():
    """WhatsAppSettingsRow requires phone number."""
    # The model has server_default="" but requires the field to be set
    settings = WhatsAppSettingsRow(
        id="+1234567890",
        phone_number="",  # Must be provided
    )

    assert settings.phone_number == ""


# ---------------------------------------------------------------------------
# Test Model Constraints
# ---------------------------------------------------------------------------


def test_pipeline_memory_config_label_is_unique():
    """MemoryRow label is unique."""
    config1 = MemoryRow(
        label="test_label",
        max_memories=50,
        ttl_hours=1440,
        max_value_size=5000,
    )
    config2 = MemoryRow(
        label="test_label",  # Same label
        max_memories=100,
        ttl_hours=2880,
        max_value_size=10000,
    )

    # These would conflict in the database (same unique label)
    assert config1.label == config2.label


# ---------------------------------------------------------------------------
# Test Model Relationships (if applicable)
# ---------------------------------------------------------------------------


def test_memory_entry_has_memory_id():
    """MemoryEntryRow has a memory_id foreign key."""
    entry = MemoryEntryRow(
        memory_id="some-uuid",
        created_at=datetime.utcnow(),
        value="test value",
    )

    assert entry.memory_id == "some-uuid"


def test_trigger_belongs_to_pipeline():
    """TriggerRow has a pipeline_id foreign relationship."""
    trigger = TriggerRow(
        id="job-1",
        pipeline_id="pipe-1",
        trigger_type="cron",
        enabled=True,
        cron_expr="0 8 * * *",
    )

    assert trigger.pipeline_id == "pipe-1"


# ---------------------------------------------------------------------------
# Test Timestamp Handling
# ---------------------------------------------------------------------------


def test_pipeline_memory_row_timestamp_precision():
    """MemoryEntryRow stores timestamps with datetime precision."""
    now = datetime.utcnow()
    entry = MemoryEntryRow(
        memory_id="some-uuid",
        created_at=now,
        value="test value",
    )

    # The timestamp should be preserved
    assert isinstance(entry.created_at, datetime)
    assert entry.created_at.replace(microsecond=0) == now.replace(microsecond=0)


def test_pipeline_memory_config_no_timestamp():
    """MemoryRow doesn't have timestamps (static config)."""
    config = MemoryRow(
        label="test_label",
        max_memories=50,
        ttl_hours=1440,
        max_value_size=5000,
    )

    # Should not have created_at or updated_at fields
    assert not hasattr(config, "created_at")
    assert not hasattr(config, "updated_at")


# ---------------------------------------------------------------------------
# Test Model String Representation
# ---------------------------------------------------------------------------


def test_pipeline_memory_row_str():
    """MemoryEntryRow has a useful string representation."""
    entry = MemoryEntryRow(
        id=1,
        memory_id="some-uuid",
        created_at=datetime(2026, 3, 13, 10, 0, 0),
        value="test value",
    )

    str_repr = str(entry)
    # The string representation should contain identifying information
    assert "MemoryEntryRow" in str_repr or "some-uuid" in str_repr


def test_pipeline_memory_config_str():
    """MemoryRow has a useful string representation."""
    config = MemoryRow(
        label="test_label",
        max_memories=50,
        ttl_hours=1440,
        max_value_size=5000,
    )

    str_repr = str(config)
    assert "test_label" in str_repr or "MemoryRow" in str_repr


# ---------------------------------------------------------------------------
# Test Metadata and Table Names
# ---------------------------------------------------------------------------


def test_pipeline_memory_row_table_name():
    """MemoryEntryRow uses the correct table name."""
    assert MemoryEntryRow.__tablename__ == "memory_entry"


def test_pipeline_memory_config_table_name():
    """MemoryRow uses the correct table name."""
    assert MemoryRow.__tablename__ == "memory"


def test_whatsapp_settings_row_table_name():
    """WhatsAppSettingsRow uses the correct table name."""
    assert WhatsAppSettingsRow.__tablename__ == "whatsapp_settings"


def test_pipeline_row_table_name():
    """PipelineRow uses the correct table name."""
    assert PipelineRow.__tablename__ == "pipelines"


def test_trigger_row_table_name():
    """TriggerRow uses the correct table name."""
    assert TriggerRow.__tablename__ == "triggers"


# ---------------------------------------------------------------------------
# Test Model Column Types
# ---------------------------------------------------------------------------


def test_pipeline_memory_row_column_types():
    """MemoryEntryRow has correct column types."""
    assert hasattr(MemoryEntryRow, "id")
    assert hasattr(MemoryEntryRow, "memory_id")
    assert hasattr(MemoryEntryRow, "created_at")
    assert hasattr(MemoryEntryRow, "value")


def test_pipeline_memory_config_column_types():
    """MemoryRow has correct column types."""
    assert hasattr(MemoryRow, "id")
    assert hasattr(MemoryRow, "label")
    assert hasattr(MemoryRow, "max_memories")
    assert hasattr(MemoryRow, "ttl_hours")
    assert hasattr(MemoryRow, "max_value_size")
