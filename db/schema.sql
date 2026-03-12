-- mee6 database schema — current state
--
-- This file reflects the full schema after all migrations have been applied.
-- It is kept for reference and local dev bootstrapping; the application uses
-- SQLAlchemy create_all + the files in db/migrations/ at startup.

CREATE TABLE IF NOT EXISTS pipelines (
    id           VARCHAR PRIMARY KEY,
    name         VARCHAR NOT NULL,
    steps        JSONB   NOT NULL DEFAULT '[]'
);

-- trigger_type values: 'cron', 'whatsapp'
-- cron triggers: cron_expr is required, config is null
-- whatsapp triggers: cron_expr is null, config = {"phone": "+E164"}
CREATE TABLE IF NOT EXISTS triggers (
    id            VARCHAR PRIMARY KEY,
    pipeline_id   VARCHAR NOT NULL,
    pipeline_name VARCHAR NOT NULL,
    trigger_type  VARCHAR NOT NULL DEFAULT 'cron',
    cron_expr     VARCHAR,
    config        JSONB,
    enabled       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS run_records (
    id            SERIAL PRIMARY KEY,
    pipeline_id   VARCHAR,              -- nullable: history survives pipeline deletion
    pipeline_name VARCHAR  NOT NULL,
    timestamp     TIMESTAMP NOT NULL,
    status        VARCHAR  NOT NULL,
    summary       TEXT     NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id        SERIAL PRIMARY KEY,
    sender    VARCHAR   NOT NULL,       -- digits only, no '+' prefix
    text      TEXT      NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    chat_id   VARCHAR                   -- NULL = DM; group JID (xxx@g.us) for group messages
);

CREATE INDEX IF NOT EXISTS ix_wa_messages_sender_ts
    ON whatsapp_messages (sender, timestamp);

CREATE INDEX IF NOT EXISTS ix_wa_messages_chat_ts
    ON whatsapp_messages (chat_id, timestamp)
    WHERE chat_id IS NOT NULL;

-- Groups discovered via WhatsApp API; synced from the Integrations page.
CREATE TABLE IF NOT EXISTS whatsapp_groups (
    jid   VARCHAR PRIMARY KEY,
    name  VARCHAR NOT NULL,
    label VARCHAR NOT NULL DEFAULT ''
);

-- Named Google Calendar targets, managed via the Integrations page.
CREATE TABLE IF NOT EXISTS calendars (
    id               VARCHAR PRIMARY KEY,
    label            VARCHAR NOT NULL,
    calendar_id      VARCHAR NOT NULL,
    credentials_file VARCHAR NOT NULL DEFAULT '/app/data/credentials.json'
);
