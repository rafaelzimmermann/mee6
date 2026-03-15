class CronDispatcherJob < ApplicationJob
  queue_as :default

  def perform(pipeline_id)
    PipelineJob.perform_later(pipeline_id)
  end
end
