require "rails_helper"

RSpec.describe "Api::V1::Integrations::Whatsapp", type: :request do
  before { sign_in_admin }

  describe "GET /api/v1/integrations/whatsapp/status" do
    it "proxies response from WhatsApp service" do
      ENV["WHATSAPP_SERVICE_URL"] = "http://whatsapp:8002"
      ENV["WHATSAPP_SERVICE_SECRET"] = "test_secret"

      stub_request(:get, "http://whatsapp:8002/status")
        .with(headers: { "X-Webhook-Secret" => "test_secret" })
        .to_return(status: 200, body: JSON.generate({ status: "connected", qr_svg: nil }))

      get "/api/v1/integrations/whatsapp/status"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq({ "status" => "connected", "qr_svg" => nil })
    end

    it "returns 502 when WhatsApp service returns error" do
      ENV["WHATSAPP_SERVICE_URL"] = "http://whatsapp:8002"
      ENV["WHATSAPP_SERVICE_SECRET"] = "test_secret"

      stub_request(:get, "http://whatsapp:8002/status")
        .to_return(status: 503)

      get "/api/v1/integrations/whatsapp/status"

      expect(response).to have_http_status(:bad_gateway)
    end
  end

  describe "POST /api/v1/integrations/whatsapp/connect" do
    it "returns 202" do
      ENV["WHATSAPP_SERVICE_URL"] = "http://whatsapp:8002"
      ENV["WHATSAPP_SERVICE_SECRET"] = "test_secret"

      stub_request(:post, "http://whatsapp:8002/connect")
        .with(headers: { "X-Webhook-Secret" => "test_secret" })
        .to_return(status: 202, body: JSON.generate({ ok: true }))

      post "/api/v1/integrations/whatsapp/connect"

      expect(response).to have_http_status(:accepted)
    end

    it "returns 502 when WhatsApp service returns error" do
      ENV["WHATSAPP_SERVICE_URL"] = "http://whatsapp:8002"
      ENV["WHATSAPP_SERVICE_SECRET"] = "test_secret"

      stub_request(:post, "http://whatsapp:8002/connect")
        .to_return(status: 503)

      post "/api/v1/integrations/whatsapp/connect"

      expect(response).to have_http_status(:bad_gateway)
    end
  end

  describe "POST /api/v1/integrations/whatsapp/disconnect" do
    it "returns 200" do
      ENV["WHATSAPP_SERVICE_URL"] = "http://whatsapp:8002"
      ENV["WHATSAPP_SERVICE_SECRET"] = "test_secret"

      stub_request(:post, "http://whatsapp:8002/disconnect")
        .with(headers: { "X-Webhook-Secret" => "test_secret" })
        .to_return(status: 200, body: JSON.generate({ ok: true }))

      post "/api/v1/integrations/whatsapp/disconnect"

      expect(response).to have_http_status(:ok)
    end

    it "returns 502 when WhatsApp service returns error" do
      ENV["WHATSAPP_SERVICE_URL"] = "http://whatsapp:8002"
      ENV["WHATSAPP_SERVICE_SECRET"] = "test_secret"

      stub_request(:post, "http://whatsapp:8002/disconnect")
        .to_return(status: 503)

      post "/api/v1/integrations/whatsapp/disconnect"

      expect(response).to have_http_status(:bad_gateway)
    end
  end

  describe "GET /api/v1/integrations/whatsapp/groups" do
    it "returns groups and upserts WhatsAppGroup records" do
      ENV["WHATSAPP_SERVICE_URL"] = "http://whatsapp:8002"
      ENV["WHATSAPP_SERVICE_SECRET"] = "test_secret"

      groups_data = [
        { "jid" => "1234567890@g.us", "name" => "Test Group 1" },
        { "jid" => "9876543210@g.us", "name" => "Test Group 2" }
      ]

      stub_request(:get, "http://whatsapp:8002/groups")
        .with(headers: { "X-Webhook-Secret" => "test_secret" })
        .to_return(status: 200, body: JSON.generate(groups_data))

      get "/api/v1/integrations/whatsapp/groups"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq(groups_data)
      expect(WhatsAppGroup.count).to eq(2)
      expect(WhatsAppGroup.find_by(jid: "1234567890@g.us").name).to eq("Test Group 1")
      expect(WhatsAppGroup.find_by(jid: "9876543210@g.us").name).to eq("Test Group 2")
    end

    it "updates existing WhatsAppGroup records" do
      ENV["WHATSAPP_SERVICE_URL"] = "http://whatsapp:8002"
      ENV["WHATSAPP_SERVICE_SECRET"] = "test_secret"

      WhatsAppGroup.create!(jid: "1234567890@g.us", name: "Old Name")

      groups_data = [
        { jid: "1234567890@g.us", name: "New Name" }
      ]

      stub_request(:get, "http://whatsapp:8002/groups")
        .with(headers: { "X-Webhook-Secret" => "test_secret" })
        .to_return(status: 200, body: JSON.generate(groups_data))

      get "/api/v1/integrations/whatsapp/groups"

      expect(response).to have_http_status(:ok)
      expect(WhatsAppGroup.count).to eq(1)
      expect(WhatsAppGroup.find_by(jid: "1234567890@g.us").name).to eq("New Name")
    end

    it "returns 502 when WhatsApp service returns error" do
      ENV["WHATSAPP_SERVICE_URL"] = "http://whatsapp:8002"
      ENV["WHATSAPP_SERVICE_SECRET"] = "test_secret"

      stub_request(:get, "http://whatsapp:8002/groups")
        .to_return(status: 503)

      get "/api/v1/integrations/whatsapp/groups"

      expect(response).to have_http_status(:bad_gateway)
    end
  end

  describe "GET /api/v1/integrations/whatsapp/settings" do
    it "returns phone_number" do
      setting = WhatsAppSetting.current
      setting.update!(phone_number: "+15550193456")

      get "/api/v1/integrations/whatsapp/settings"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq({ "phone_number" => "+15550193456" })
    end

    it "returns empty string when setting is not set" do
      get "/api/v1/integrations/whatsapp/settings"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq({ "phone_number" => "" })
    end
  end

  describe "PUT /api/v1/integrations/whatsapp/settings" do
    it "updates phone_number" do
      put "/api/v1/integrations/whatsapp/settings",
          params: { whatsapp_setting: { phone_number: "+15550193456" } }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq({ "phone_number" => "+15550193456" })
      expect(WhatsAppSetting.current.phone_number).to eq("+15550193456")
    end

    it "returns 422 with invalid params" do
      put "/api/v1/integrations/whatsapp/settings",
          params: { whatsapp_setting: { phone_number: nil } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)).to have_key("error")
    end
  end
end
