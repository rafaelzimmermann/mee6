-- Fix pipeline_steps rows where config was accidentally stored as the full
-- step wrapper {agent_type, config: {...}} instead of just the inner config dict.
UPDATE pipeline_steps
SET config = config->'config'
WHERE config ? 'config' AND jsonb_typeof(config->'config') = 'object';
