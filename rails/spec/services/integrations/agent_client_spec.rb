require "rails_helper"

RSpec.describe Integrations::AgentClient do
  let(:client) { described_class.new }
  let(:agent_service_url) { ENV.fetch("AGENT_SERVICE_URL") }
  let(:agent_service_secret) { ENV.fetch("AGENT_SERVICE_SECRET") }

  before do
    stub_const("ENV", {
      "AGENT_SERVICE_URL" => agent_service_url,
      "AGENT_SERVICE_SECRET" => agent_service_secret
    })
  end

  describe "#run" do
    let(:agent_type) { "llm_agent" }
    let(:config) { { "model" => "gpt-4" } }
    let(:input) { "Hello, world!" }

    context "when the service returns 200" do
      before do
        stub_request(:post, "#{agent_service_url}/run")
          .with(
            headers: {
              "Content-Type" => "application/json",
              "X-Service-Secret" => agent_service_secret
            },
            body: { agent_type:, config:, input: }.to_json
          )
          .to_return(status: 200, body: { "output" => "AI response" }.to_json)
      end

      it "returns the parsed response body" do
        result = client.run(agent_type:, config:, input:)
        expect(result).to eq({ "output" => "AI response" })
      end
    end

    context "when the service returns a non-2xx status" do
      before do
        stub_request(:post, "#{agent_service_url}/run")
          .to_return(status: 500, body: { "error" => "Internal server error" }.to_json)
      end

      it "raises ServiceError" do
        expect do
          client.run(agent_type:, config:, input:)
        end.to raise_error(Integrations::AgentClient::ServiceError, /Agent service returned 500/)
      end
    end

    context "when Faraday times out" do
      before do
        stub_request(:post, "#{agent_service_url}/run")
          .to_timeout
      end

      it "raises TimeoutError" do
        expect do
          client.run(agent_type:, config:, input:)
        end.to raise_error(Integrations::AgentClient::TimeoutError)
      end
    end
  end
end
