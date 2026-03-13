-- pipeline_name in triggers is redundant — the authoritative name lives in pipelines.name.
-- Derive the name at query time instead of storing a stale copy.
ALTER TABLE triggers DROP COLUMN IF EXISTS pipeline_name;
