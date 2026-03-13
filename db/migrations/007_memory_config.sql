-- Create table for memory configuration (max_memories, ttl_hours, max_value_size)
CREATE TABLE IF NOT EXISTS pipeline_memory_configs (
    label VARCHAR(255) PRIMARY KEY,
    max_memories INTEGER NOT NULL DEFAULT 20,
    ttl_hours INTEGER NOT NULL DEFAULT 720,
    max_value_size INTEGER NOT NULL DEFAULT 2000
);
