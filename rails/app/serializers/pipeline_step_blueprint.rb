class PipelineStepBlueprint < Blueprinter::Base
  identifier :id
  fields :step_index, :agent_type, :config
end
