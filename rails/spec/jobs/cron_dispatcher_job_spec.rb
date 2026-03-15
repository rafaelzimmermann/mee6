require "rails_helper"

RSpec.describe CronDispatcherJob do
  let(:job) { described_class.new }
  let(:pipeline) { create(:pipeline) }
  let(:pipeline_id) { pipeline.id }

  before do
    ActiveJob::Base.queue_adapter = :test
  end

  describe "#perform" do
    it "enqueues PipelineJob with given pipeline_id" do
      expect { job.perform(pipeline_id) }.to have_enqueued_job(PipelineJob).with(pipeline_id)
    end
  end
end
