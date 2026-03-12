-- Add chat_id to whatsapp_messages for group message support.
-- chat_id is NULL for DMs (existing rows unaffected), group JID for group messages.
-- Also creates whatsapp_groups to store discovered groups.

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS chat_id VARCHAR;

CREATE INDEX IF NOT EXISTS ix_wa_messages_chat_ts
    ON whatsapp_messages (chat_id, timestamp)
    WHERE chat_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS whatsapp_groups (
    jid   VARCHAR PRIMARY KEY,
    name  VARCHAR NOT NULL,
    label VARCHAR NOT NULL DEFAULT ''
);
