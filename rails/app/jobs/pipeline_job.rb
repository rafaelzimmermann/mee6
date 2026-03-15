class PipelineJob < ApplicationJob
  queue_as :default

  sidekiq_options timeout: 300

  def perform(pipeline_id, initial_input = "")
    pipeline = Pipeline.includes(:pipeline_steps).find(pipeline_id)

    result = Pipelines::ExecutorService.new.call(
      pipeline:      pipeline,
      initial_input: initial_input
    )

    RunRecord.create!(
      pipeline_id:   pipeline.id,
      pipeline_name: pipeline.name,
      timestamp:     Time.current,
      status:        "success",
      summary:       result.output.to_s.truncate(2000)
    )
  rescue => e
    name = pipeline&.name || pipeline_id
    RunRecord.create!(
      pipeline_id:   pipeline_id,
      pipeline_name: name,
      timestamp:     Time.current,
      status:        "error",
      summary:       "#{e.class}: #{e.message}".truncate(2000)
    )
    raise
  end
end
