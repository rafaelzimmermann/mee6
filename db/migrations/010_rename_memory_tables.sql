-- Rename pipeline_memory_configs to memory (adding UUID id as PK)
-- Rename pipeline_memories to memory_entry (referencing memory_id FK instead of label)
-- Idempotent: IF NOT EXISTS guards + DO blocks with EXECUTE for conditional data migration.

CREATE TABLE IF NOT EXISTS memory (
    id          VARCHAR(36) PRIMARY KEY,
    label       VARCHAR(255) NOT NULL UNIQUE,
    max_memories INTEGER NOT NULL DEFAULT 20,
    ttl_hours   INTEGER NOT NULL DEFAULT 720,
    max_value_size INTEGER NOT NULL DEFAULT 2000
);

-- Migrate config rows from old table only if it still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pipeline_memory_configs'
  ) THEN
    EXECUTE '
      INSERT INTO memory (id, label, max_memories, ttl_hours, max_value_size)
      SELECT gen_random_uuid()::text, label, max_memories, ttl_hours, max_value_size
      FROM pipeline_memory_configs
      WHERE NOT EXISTS (SELECT 1 FROM memory WHERE memory.label = pipeline_memory_configs.label)
    ';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS memory_entry (
    id          SERIAL PRIMARY KEY,
    memory_id   VARCHAR(36) NOT NULL REFERENCES memory(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL,
    value       TEXT NOT NULL
);

-- Migrate entries from old table only if it still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pipeline_memories'
  ) THEN
    EXECUTE '
      INSERT INTO memory_entry (memory_id, created_at, value)
      SELECT m.id, pm.created_at, pm.value
      FROM pipeline_memories pm
      JOIN memory m ON pm.label = m.label
    ';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_memory_entry_memory_id_created ON memory_entry (memory_id, created_at DESC);

DROP TABLE IF EXISTS pipeline_memories;
DROP TABLE IF EXISTS pipeline_memory_configs;
