-- Rename pipeline_memory_configs to memory (adding UUID id as PK)
-- Rename pipeline_memories to memory_entry (referencing memory_id FK instead of label)

CREATE TABLE memory (
    id          VARCHAR(36) PRIMARY KEY,
    label       VARCHAR(255) NOT NULL UNIQUE,
    max_memories INTEGER NOT NULL DEFAULT 20,
    ttl_hours   INTEGER NOT NULL DEFAULT 720,
    max_value_size INTEGER NOT NULL DEFAULT 2000
);

-- Migrate existing config data (generate UUID ids)
INSERT INTO memory (id, label, max_memories, ttl_hours, max_value_size)
SELECT gen_random_uuid()::text, label, max_memories, ttl_hours, max_value_size
FROM pipeline_memory_configs;

CREATE TABLE memory_entry (
    id          SERIAL PRIMARY KEY,
    memory_id   VARCHAR(36) NOT NULL REFERENCES memory(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL,
    value       TEXT NOT NULL
);

-- Migrate existing entries (only those with matching config)
INSERT INTO memory_entry (memory_id, created_at, value)
SELECT m.id, pm.created_at, pm.value
FROM pipeline_memories pm
JOIN memory m ON pm.label = m.label;

CREATE INDEX ix_memory_entry_memory_id_created ON memory_entry (memory_id, created_at DESC);

DROP TABLE IF EXISTS pipeline_memories;
DROP TABLE IF EXISTS pipeline_memory_configs;
