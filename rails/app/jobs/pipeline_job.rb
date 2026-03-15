class PipelineJob < ApplicationJob
  queue_as :default

  def perform(pipeline_id)
  end
end
