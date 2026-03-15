require "rails_helper"

RSpec.describe Integrations::WhatsAppClient do
  let(:client) { described_class.new }
  let(:whatsapp_service_url) { ENV.fetch("WHATSAPP_SERVICE_URL") }
  let(:whatsapp_service_secret) { ENV.fetch("WHATSAPP_SERVICE_SECRET") }

  before do
    stub_const("ENV", {
      "WHATSAPP_SERVICE_URL" => whatsapp_service_url,
      "WHATSAPP_SERVICE_SECRET" => whatsapp_service_secret
    })
  end

  describe "#send" do
    let(:to) { "+1234567890" }
    let(:text) { "Hello, WhatsApp!" }

    context "when the service returns 200" do
      before do
        stub_request(:post, "#{whatsapp_service_url}/send")
          .with(
            headers: {
              "Content-Type" => "application/json",
              "X-Webhook-Secret" => whatsapp_service_secret
            },
            body: { to:, text: }.to_json
          )
          .to_return(status: 200, body: { "success" => true }.to_json)
      end

      it "returns the parsed response body" do
        result = client.send(to:, text:)
        expect(result).to eq({ "success" => true })
      end
    end

    context "when the service returns a non-2xx status" do
      before do
        stub_request(:post, "#{whatsapp_service_url}/send")
          .to_return(status: 500, body: { "error" => "Service unavailable" }.to_json)
      end

      it "raises ServiceError" do
        expect do
          client.send(to:, text:)
        end.to raise_error(Integrations::WhatsAppClient::ServiceError, /WhatsApp service error 500/)
      end
    end
  end

  describe "#status" do
    before do
      stub_request(:get, "#{whatsapp_service_url}/status")
        .with(
          headers: { "X-Webhook-Secret" => whatsapp_service_secret }
        )
        .to_return(status: 200, body: { "status" => "connected", "qr_svg" => nil }.to_json)
    end

    it "returns the parsed response body" do
      result = client.status
      expect(result).to eq({ "status" => "connected", "qr_svg" => nil })
    end
  end

  describe "#groups" do
    before do
      stub_request(:get, "#{whatsapp_service_url}/groups")
        .with(
          headers: { "X-Webhook-Secret" => whatsapp_service_secret }
        )
        .to_return(status: 200, body: [
          { "jid" => "group1@example.com", "name" => "Group 1" },
          { "jid" => "group2@example.com", "name" => "Group 2" }
        ].to_json)
    end

    it "returns the parsed response body" do
      result = client.groups
      expect(result).to eq([
        { "jid" => "group1@example.com", "name" => "Group 1" },
        { "jid" => "group2@example.com", "name" => "Group 2" }
      ])
    end
  end

  describe "#monitor" do
    let(:callback_url) { "https://example.com/webhook" }

    before do
      stub_request(:post, "#{whatsapp_service_url}/monitor")
        .with(
          headers: {
            "Content-Type" => "application/json",
            "X-Webhook-Secret" => whatsapp_service_secret
          },
          body: { callback_url:, phones: [], group_jids: [] }.to_json
        )
        .to_return(status: 200, body: { "success" => true }.to_json)
    end

    it "returns the parsed response body" do
      result = client.monitor(callback_url:)
      expect(result).to eq({ "success" => true })
    end
  end

  describe "#connect" do
    before do
      stub_request(:post, "#{whatsapp_service_url}/connect")
        .to_return(status: 200, body: { "success" => true }.to_json)
    end

    it "returns the parsed response body" do
      result = client.connect
      expect(result).to eq({ "success" => true })
    end
  end

  describe "#disconnect" do
    before do
      stub_request(:post, "#{whatsapp_service_url}/disconnect")
        .to_return(status: 200, body: { "success" => true }.to_json)
    end

    it "returns the parsed response body" do
      result = client.disconnect
      expect(result).to eq({ "success" => true })
    end
  end
end
