class PipelineBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :created_at, :updated_at

  view :with_steps do
    association :pipeline_steps, blueprint: PipelineStepBlueprint
  end
end
