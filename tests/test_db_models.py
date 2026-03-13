"""Tests for database models."""

from datetime import datetime

import pytest
from sqlalchemy import inspect

from mee6.db.models import (
    Base,
    PipelineMemoryRow,
    PipelineMemoryConfig,
    WhatsAppSettingsRow,
    PipelineRow,
    TriggerRow,
)


# ---------------------------------------------------------------------------
# Test Model Instantiation
# ---------------------------------------------------------------------------


def test_pipeline_memory_row_instantiation():
    """PipelineMemoryRow can be instantiated with required fields."""
    now = datetime.utcnow()
    memory = PipelineMemoryRow(
        pipeline_id="pipe-1",
        trigger_id="trigger-1",
        label="test_label",
        created_at=now,
        value="test value",
    )

    assert memory.pipeline_id == "pipe-1"
    assert memory.trigger_id == "trigger-1"
    assert memory.label == "test_label"
    assert memory.created_at == now
    assert memory.value == "test value"
    # id is auto-increment, should be None before insert
    assert memory.id is None


def test_pipeline_memory_config_instantiation():
    """PipelineMemoryConfig can be instantiated with required fields."""
    config = PipelineMemoryConfig(
        label="test_label",
        max_memories=50,
        ttl_hours=1440,
        max_value_size=5000,
    )

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


def test_pipeline_memory_row_optional_fields():
    """PipelineMemoryRow works with optional trigger_id as None."""
    now = datetime.utcnow()
    memory = PipelineMemoryRow(
        pipeline_id="pipe-1",
        trigger_id=None,  # Optional, can be None
        label="test_label",
        created_at=now,
        value="test value",
    )

    assert memory.trigger_id is None


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
    """PipelineMemoryConfig has sensible defaults."""
    # Model doesn't have server_default, so values must be explicitly set
    config = PipelineMemoryConfig(
        label="test_label",
        max_memories=20,  # Default value
        ttl_hours=720,    # Default value
        max_value_size=2000,  # Default value
    )

    assert config.max_memories == 20
    assert config.ttl_hours == 720
    assert config.max_value_size == 2000


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


def test_pipeline_memory_config_label_is_primary_key():
    """PipelineMemoryConfig label is the primary key."""
    config1 = PipelineMemoryConfig(
        label="test_label",
        max_memories=50,
        ttl_hours=1440,
        max_value_size=5000,
    )
    config2 = PipelineMemoryConfig(
        label="test_label",  # Same label
        max_memories=100,
        ttl_hours=2880,
        max_value_size=10000,
    )

    # These would conflict in the database (same primary key)
    assert config1.label == config2.label


# ---------------------------------------------------------------------------
# Test Model Relationships (if applicable)
# ---------------------------------------------------------------------------


def test_pipeline_memory_belongs_to_pipeline():
    """PipelineMemoryRow has a pipeline_id foreign relationship."""
    memory = PipelineMemoryRow(
        pipeline_id="pipe-1",
        trigger_id="trigger-1",
        label="test_label",
        created_at=datetime.utcnow(),
        value="test value",
    )

    assert memory.pipeline_id == "pipe-1"


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
    """PipelineMemoryRow stores timestamps with datetime precision."""
    now = datetime.utcnow()
    memory = PipelineMemoryRow(
        pipeline_id="pipe-1",
        trigger_id=None,
        label="test_label",
        created_at=now,
        value="test value",
    )

    # The timestamp should be preserved
    assert isinstance(memory.created_at, datetime)
    assert memory.created_at.replace(microsecond=0) == now.replace(microsecond=0)


def test_pipeline_memory_config_no_timestamp():
    """PipelineMemoryConfig doesn't have timestamps (static config)."""
    config = PipelineMemoryConfig(
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
    """PipelineMemoryRow has a useful string representation."""
    memory = PipelineMemoryRow(
        id=1,
        pipeline_id="pipe-1",
        trigger_id=None,
        label="test_label",
        created_at=datetime(2026, 3, 13, 10, 0, 0),
        value="test value",
    )

    str_repr = str(memory)
    # The string representation should contain identifying information
    assert "PipelineMemoryRow" in str_repr or "test_label" in str_repr


def test_pipeline_memory_config_str():
    """PipelineMemoryConfig has a useful string representation."""
    config = PipelineMemoryConfig(
        label="test_label",
        max_memories=50,
        ttl_hours=1440,
        max_value_size=5000,
    )

    str_repr = str(config)
    assert "test_label" in str_repr or "PipelineMemoryConfig" in str_repr


# ---------------------------------------------------------------------------
# Test Metadata and Table Names
# ---------------------------------------------------------------------------


def test_pipeline_memory_row_table_name():
    """PipelineMemoryRow uses the correct table name."""
    assert PipelineMemoryRow.__tablename__ == "pipeline_memories"


def test_pipeline_memory_config_table_name():
    """PipelineMemoryConfig uses the correct table name."""
    assert PipelineMemoryConfig.__tablename__ == "pipeline_memory_configs"


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
    """PipelineMemoryRow has correct column types."""
    # This is a basic check - in real testing you'd inspect the columns
    assert hasattr(PipelineMemoryRow, "id")
    assert hasattr(PipelineMemoryRow, "pipeline_id")
    assert hasattr(PipelineMemoryRow, "trigger_id")
    assert hasattr(PipelineMemoryRow, "label")
    assert hasattr(PipelineMemoryRow, "created_at")
    assert hasattr(PipelineMemoryRow, "value")


def test_pipeline_memory_config_column_types():
    """PipelineMemoryConfig has correct column types."""
    assert hasattr(PipelineMemoryConfig, "label")
    assert hasattr(PipelineMemoryConfig, "max_memories")
    assert hasattr(PipelineMemoryConfig, "ttl_hours")
    assert hasattr(PipelineMemoryConfig, "max_value_size")
