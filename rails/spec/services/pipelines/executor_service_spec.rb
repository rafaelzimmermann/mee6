require "rails_helper"

RSpec.describe Pipelines::ExecutorService do
  let(:service) { described_class.new }
  let(:pipeline) { create(:pipeline) }
  let(:agent_service_url) { ENV.fetch("AGENT_SERVICE_URL") }
  let(:agent_service_secret) { ENV.fetch("AGENT_SERVICE_SECRET") }
  let(:whatsapp_service_url) { ENV.fetch("WHATSAPP_SERVICE_URL") }
  let(:whatsapp_service_secret) { ENV.fetch("WHATSAPP_SERVICE_SECRET") }

  before do
    stub_const("ENV", {
      "AGENT_SERVICE_URL" => agent_service_url,
      "AGENT_SERVICE_SECRET" => agent_service_secret,
      "WHATSAPP_SERVICE_URL" => whatsapp_service_url,
      "WHATSAPP_SERVICE_SECRET" => whatsapp_service_secret
    })
  end

  describe "#call" do
    context "with a debug_agent step" do
      before do
        create(:pipeline_step, pipeline:, agent_type: "debug_agent", step_index: 0, config: { debug: true })
      end

      it "passes the input through unchanged" do
        result = service.call(pipeline:, initial_input: "hello")
        expect(result.output).to eq("hello")
      end
    end

    context "with a memory_agent step" do
      let(:memory) { create(:memory, label: "test_memory") }
      let(:memory_service) { instance_double(Memories::AgentService) }

      before do
        create(:pipeline_step, pipeline:, agent_type: "memory_agent", step_index: 0,
               config: { memory_label: "test_memory", operation: "read" })
        allow(Memories::AgentService).to receive(:new).and_return(memory_service)
        allow(memory_service).to receive(:call).and_return("memory output")
      end

      it "delegates to Memories::AgentService" do
        result = service.call(pipeline:, initial_input: "input")
        expect(result.output).to eq("memory output")
        expect(memory_service).to have_received(:call)
          .with(config: { memory_label: "test_memory", operation: "read" }, input: "input")
      end
    end

    context "with an llm_agent step" do
      before do
        create(:pipeline_step, pipeline:, agent_type: "llm_agent", step_index: 0,
               config: { model: "gpt-4" })

        stub_request(:post, "#{agent_service_url}/run")
          .with(
            headers: {
              "Content-Type" => "application/json",
              "X-Service-Secret" => agent_service_secret
            },
            body: { agent_type: "llm_agent", config: { model: "gpt-4" }, input: "hello" }.to_json
          )
          .to_return(status: 200, body: { "output" => "AI response" }.to_json)
      end

      it "calls AgentClient#run and returns the output" do
        result = service.call(pipeline:, initial_input: "hello")
        expect(result.output).to eq("AI response")
      end
    end

    context "with a whatsapp_agent step" do
      before do
        create(:pipeline_step, pipeline:, agent_type: "whatsapp_agent", step_index: 0,
               config: { "to" => "+1234567890" })

        stub_request(:post, "#{whatsapp_service_url}/send")
          .with(
            headers: {
              "Content-Type" => "application/json",
              "X-Webhook-Secret" => whatsapp_service_secret
            },
            body: { to: "+1234567890", text: "hello" }.to_json
          )
          .to_return(status: 200, body: { "success" => true }.to_json)
      end

      it "calls WhatsAppClient#send and passes input through" do
        result = service.call(pipeline:, initial_input: "hello")
        expect(result.output).to eq("hello")
      end
    end

    context "with multiple steps chained together" do
      let(:memory) { create(:memory, label: "test_memory") }
      let(:memory_service) { instance_double(Memories::AgentService) }

      before do
        create(:pipeline_step, pipeline:, agent_type: "debug_agent", step_index: 0, config: { debug: true })
        create(:pipeline_step, pipeline:, agent_type: "llm_agent", step_index: 1,
               config: { model: "gpt-4" })
        create(:pipeline_step, pipeline:, agent_type: "debug_agent", step_index: 2, config: { debug: true })

        stub_request(:post, "#{agent_service_url}/run")
          .to_return(status: 200, body: { "output" => "AI response" }.to_json)
      end

      it "chains the output of one step to the input of the next" do
        result = service.call(pipeline:, initial_input: "hello")
        expect(result.steps_log.length).to eq(3)
        expect(result.steps_log[0][:output]).to eq("hello")
        expect(result.steps_log[1][:input]).to eq("hello")
        expect(result.steps_log[1][:output]).to eq("AI response")
        expect(result.steps_log[2][:input]).to eq("AI response")
        expect(result.steps_log[2][:output]).to eq("AI response")
        expect(result.output).to eq("AI response")
      end
    end

    context "when AgentClient raises an error" do
      before do
        create(:pipeline_step, pipeline:, agent_type: "llm_agent", step_index: 0,
               config: { model: "gpt-4" })

        stub_request(:post, "#{agent_service_url}/run")
          .to_return(status: 500, body: { "error" => "Internal server error" }.to_json)
      end

      it "propagates the error out of ExecutorService" do
        expect do
          service.call(pipeline:, initial_input: "hello")
        end.to raise_error(Integrations::AgentClient::ServiceError)
      end
    end

    context "with whatsapp_group_send step" do
      before do
        create(:pipeline_step, pipeline:, agent_type: "whatsapp_group_send", step_index: 0,
               config: { "group_jid" => "group@example.com" })

        stub_request(:post, "#{whatsapp_service_url}/send")
          .with(
            headers: {
              "Content-Type" => "application/json",
              "X-Webhook-Secret" => whatsapp_service_secret
            },
            body: { to: "group@example.com", text: "hello" }.to_json
          )
          .to_return(status: 200, body: { "success" => true }.to_json)
      end

      it "calls WhatsAppClient#send with group_jid and passes input through" do
        result = service.call(pipeline:, initial_input: "hello")
        expect(result.output).to eq("hello")
      end
    end
  end
end
