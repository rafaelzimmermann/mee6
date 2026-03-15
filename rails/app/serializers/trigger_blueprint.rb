class TriggerBlueprint < Blueprinter::Base
  identifier :id
  fields :pipeline_id, :trigger_type, :cron_expr, :config, :enabled,
         :created_at, :updated_at
end
