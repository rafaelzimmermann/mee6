from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class PipelineRow(Base):
    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)


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
    # Normalised phone number without the '+' prefix, e.g. "34612345678"
    sender: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # NULL for DMs; group JID (e.g. "120363xxx@g.us") for group messages
    chat_id: Mapped[str | None] = mapped_column(String, nullable=True)

    __table_args__ = (
        Index("ix_wa_messages_sender_ts", "sender", "timestamp"),
        # Partial index on chat_id is created by the migration file (003_wa_groups.sql)
        # rather than here to avoid the `text` name conflict with the `text` column.
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
