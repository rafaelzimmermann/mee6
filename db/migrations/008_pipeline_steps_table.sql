-- Create pipeline_steps table for individual step storage
-- Each step has: pipeline_id, step_index, agent_type, config (JSONB)
-- On update, all steps are removed and replaced
CREATE TABLE IF NOT EXISTS pipeline_steps (
    id SERIAL PRIMARY KEY,
    pipeline_id VARCHAR(255) NOT NULL,
    step_index INTEGER NOT NULL,
    agent_type VARCHAR(255) NOT NULL,
    config JSONB NOT NULL,
    CONSTRAINT fk_pipeline_steps_pipeline
        FOREIGN KEY (pipeline_id)
        REFERENCES pipelines(id)
        ON DELETE CASCADE,
    CONSTRAINT uk_pipeline_steps_pipeline_index
        UNIQUE (pipeline_id, step_index)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS ix_pipeline_steps_pipeline_index
    ON pipeline_steps (pipeline_id, step_index);

-- Add comment to document the replace-all behavior
COMMENT ON TABLE pipeline_steps IS 'Stores individual pipeline steps. All steps are removed and replaced on pipeline update.';
COMMENT ON CONSTRAINT uk_pipeline_steps_pipeline_index ON pipeline_steps IS 'Ensures unique step ordering per pipeline';
