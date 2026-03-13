from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class PipelineRow(Base):
    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Keep for backward compatibility, will be deprecated
    steps: Mapped[list] = mapped_column(JSONB, nullable=True, default=None)
    # Relationship to steps
    steps_list: Mapped[list["PipelineStepRow"]] = relationship(
        "PipelineStepRow",
        back_populates="pipeline",
        cascade="all, delete-orphan",
        order_by="PipelineStepRow.step_index",
    )


class PipelineStepRow(Base):
    __tablename__ = "pipeline_steps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pipeline_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("pipelines.id", ondelete="CASCADE"),
        nullable=False,
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    agent_type: Mapped[str] = mapped_column(String, nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # Relationship to pipeline
    pipeline: Mapped["PipelineRow"] = relationship(
        "PipelineRow",
        back_populates="steps_list",
    )

    __table_args__ = (
        Index("ix_pipeline_steps_pipeline_index", "pipeline_id", "step_index", unique=True),
    )


class TriggerRow(Base):
    __tablename__ = "triggers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    pipeline_id: Mapped[str] = mapped_column(String, nullable=False)
    # "cron" or "whatsapp"
    trigger_type: Mapped[str] = mapped_column(String, nullable=False, server_default="cron")
    cron_expr: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Extra config (e.g. {"phone": "+34612345678"} for whatsapp triggers)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class RunRecordRow(Base):
    __tablename__ = "run_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # nullable so history is preserved after a pipeline is deleted
    pipeline_id: Mapped[str | None] = mapped_column(String, nullable=True)
    pipeline_name: Mapped[str] = mapped_column(String, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)


class CalendarRow(Base):
    __tablename__ = "calendars"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    calendar_id: Mapped[str] = mapped_column(String, nullable=False)
    credentials_file: Mapped[str] = mapped_column(
        String, nullable=False, server_default="/app/data/credentials.json"
    )


class WhatsAppMessageRow(Base):
    __tablename__ = "whatsapp_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Normalised phone number without '+' prefix, e.g. "34612345678"
    sender: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # NULL for DMs; group JID (e.g. "120363xxx@g.us") for group messages
    chat_id: Mapped[str | None] = mapped_column(String, nullable=True)

    __table_args__ = (
        Index("ix_wa_messages_sender_ts", "sender", "timestamp"),
        # Partial index on chat_id is created by migration file (003_wa_groups.sql)
        # rather than here to avoid a `text` name conflict with `text` column.
    )


class WhatsAppGroupRow(Base):
    __tablename__ = "whatsapp_groups"

    jid: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # User-editable friendly label; defaults to name on first sync
    label: Mapped[str] = mapped_column(String, nullable=False, server_default="")


class WhatsAppSettingsRow(Base):
    __tablename__ = "whatsapp_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    phone_number: Mapped[str] = mapped_column(String, nullable=False, server_default="")


class PipelineMemoryRow(Base):
    __tablename__ = "pipeline_memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pipeline_id: Mapped[str] = mapped_column(String, nullable=False)
    trigger_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class PipelineMemoryConfig(Base):
    __tablename__ = "pipeline_memory_configs"

    label: Mapped[str] = mapped_column(String, primary_key=True)
    max_memories: Mapped[int] = mapped_column(Integer, nullable=False, server_default="20")
    ttl_hours: Mapped[int] = mapped_column(Integer, nullable=False, server_default="720")
    max_value_size: Mapped[int] = mapped_column(Integer, nullable=False, server_default="2000")
