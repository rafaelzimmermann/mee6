-- Create pipeline_memories table for storing agent memory across pipeline runs.
-- Supports memorize and remember modes with TTL and eviction capabilities.
-- Safe to run repeatedly: uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS pipeline_memories (
    id          SERIAL PRIMARY KEY,
    pipeline_id VARCHAR NOT NULL,
    trigger_id  VARCHAR,          -- NULL if run manually
    label       VARCHAR NOT NULL,
    created_at  TIMESTAMP NOT NULL,
    value       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_memories_pipeline_label_ts
    ON pipeline_memories (pipeline_id, label, created_at DESC);
