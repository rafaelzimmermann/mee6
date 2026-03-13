-- WhatsApp settings (single-row, id='default')
CREATE TABLE IF NOT EXISTS whatsapp_settings (
    id          VARCHAR PRIMARY KEY,
    phone_number VARCHAR NOT NULL DEFAULT ''
);

INSERT INTO whatsapp_settings (id, phone_number)
VALUES ('default', '')
ON CONFLICT (id) DO NOTHING;
