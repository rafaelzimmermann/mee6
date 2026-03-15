require "rails_helper"

RSpec.describe PipelineJob do
  let(:job) { described_class.new }

  before do
    ActiveJob::Base.queue_adapter = :test
  end

  describe "#perform" do
    let(:pipeline) { create(:pipeline) }

    context "when the pipeline executes successfully" do
      before do
        create(:pipeline_step, pipeline:, agent_type: "debug_agent", step_index: 0, config: { debug: true })
      end

      it "creates a RunRecord with status: 'success'" do
        expect do
          job.perform(pipeline.id, "hello")
        end.to change { RunRecord.count }.by(1)

        run_record = RunRecord.last
        expect(run_record.status).to eq("success")
        expect(run_record.pipeline_id).to eq(pipeline.id)
        expect(run_record.pipeline_name).to eq(pipeline.name)
        expect(run_record.summary).to eq("hello")
      end
    end

    context "when ExecutorService raises an error" do
      let(:memory) { create(:memory, label: "test_memory") }
      let(:agent_service_url) { ENV.fetch("AGENT_SERVICE_URL") }
      let(:agent_service_secret) { ENV.fetch("AGENT_SERVICE_SECRET") }

      before do
        create(:pipeline_step, pipeline:, agent_type: "llm_agent", step_index: 0,
               config: { model: "gpt-4" })

        stub_const("ENV", {
          "AGENT_SERVICE_URL" => agent_service_url,
          "AGENT_SERVICE_SECRET" => agent_service_secret
        })

        stub_request(:post, "#{agent_service_url}/run")
          .to_return(status: 500, body: { "error" => "Internal server error" }.to_json)
      end

      it "creates a RunRecord with status: 'error' and re-raises the exception" do
        expect do
          job.perform(pipeline.id, "hello")
        end.to raise_error(Integrations::AgentClient::ServiceError)

        run_record = RunRecord.last
        expect(run_record.status).to eq("error")
        expect(run_record.pipeline_id).to eq(pipeline.id)
        expect(run_record.pipeline_name).to eq(pipeline.name)
        expect(run_record.summary).to include("Integrations::AgentClient::ServiceError")
      end
    end

    context "when the pipeline is not found" do
      it "creates a RunRecord with status: 'error' and re-raises the exception" do
        expect do
          job.perform("nonexistent-id", "hello")
        end.to raise_error(ActiveRecord::RecordNotFound)

        run_record = RunRecord.last
        expect(run_record.status).to eq("error")
        expect(run_record.pipeline_id).to eq("nonexistent-id")
        expect(run_record.pipeline_name).to eq("nonexistent-id")
        expect(run_record.summary).to include("ActiveRecord::RecordNotFound")
      end
    end

    context "when initial_input is not provided" do
      before do
        create(:pipeline_step, pipeline:, agent_type: "debug_agent", step_index: 0, config: { debug: true })
      end

      it "uses an empty string as the default" do
        expect do
          job.perform(pipeline.id)
        end.to change { RunRecord.count }.by(1)

        run_record = RunRecord.last
        expect(run_record.status).to eq("success")
        expect(run_record.summary).to eq("")
      end
    end

    context "when the output is too long" do
      before do
        create(:pipeline_step, pipeline:, agent_type: "debug_agent", step_index: 0, config: { debug: true })
      end

      it "truncates the summary to 2000 characters" do
        long_input = "a" * 3000
        job.perform(pipeline.id, long_input)

        run_record = RunRecord.last
        expect(run_record.summary.length).to eq(2000)
        expect(run_record.summary).to end_with("...")
      end
    end
  end
end
