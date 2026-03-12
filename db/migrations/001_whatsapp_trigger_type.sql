-- Add trigger_type and config columns to support non-cron trigger types.
-- cron_expr is made nullable since WhatsApp triggers don't use it.
-- Safe to run repeatedly: all statements use IF NOT EXISTS / conditional DDL.

ALTER TABLE triggers ADD COLUMN IF NOT EXISTS trigger_type VARCHAR NOT NULL DEFAULT 'cron';
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS config JSONB;
ALTER TABLE triggers ALTER COLUMN cron_expr DROP NOT NULL;
