# Sample pipeline with two steps
pipeline = Pipeline.find_or_create_by!(id: "seed-pipeline-001") do |p|
  p.name = "Demo Pipeline"
end

pipeline.pipeline_steps.destroy_all
pipeline.pipeline_steps.create!(step_index: 0, agent_type: "llm_agent", config: { prompt: "Summarise: {{input}}" })
pipeline.pipeline_steps.create!(step_index: 1, agent_type: "debug_agent", config: {})

# Cron trigger — every day at 08:00
Trigger.find_or_create_by!(id: "seed-trigger-cron-001") do |t|
  t.pipeline    = pipeline
  t.trigger_type = :cron
  t.cron_expr   = "0 8 * * *"
  t.enabled     = false
end

# WhatsApp trigger
Trigger.find_or_create_by!(id: "seed-trigger-wa-001") do |t|
  t.pipeline     = pipeline
  t.trigger_type = :whatsapp
  t.config       = { phone: "+15550001234" }
  t.enabled      = false
end

# Memory config
Memory.find_or_create_by!(label: "general") do |m|
  m.id             = "seed-memory-001"
  m.max_memories   = 50
  m.ttl_hours      = 48
  m.max_value_size = 500
end

# WhatsApp settings skeleton
WhatsAppSetting.current