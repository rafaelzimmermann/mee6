class RunRecordBlueprint < Blueprinter::Base
  identifier :id
  fields :pipeline_id, :pipeline_name, :timestamp, :status, :summary,
         :created_at
end
