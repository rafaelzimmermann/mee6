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
    timestamp TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_wa_messages_sender_ts
    ON whatsapp_messages (sender, timestamp);
