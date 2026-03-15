require "rails_helper"

RSpec.describe "Api::V1::Integrations::WhatsappGroups", type: :request do
  before { sign_in_admin }

  describe "GET /api/v1/integrations/whatsapp_groups" do
    it "returns array of whatsapp groups" do
      create(:whats_app_group, jid: "1234567890@g.us", name: "Test Group 1", label: "Group 1")
      create(:whats_app_group, jid: "9876543210@g.us", name: "Test Group 2", label: "Group 2")

      get "/api/v1/integrations/whatsapp_groups"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to be_an(Array)
      expect(body.length).to eq(2)
      expect(body.first["jid"]).to eq("1234567890@g.us")
      expect(body.first["name"]).to eq("Test Group 1")
    end

    it "returns empty array when no groups exist" do
      get "/api/v1/integrations/whatsapp_groups"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq([])
    end
  end

  describe "PUT /api/v1/integrations/whatsapp_groups/:jid" do
    it "updates group label" do
      group = create(:whats_app_group, jid: "1234567890@g.us", name: "Test Group", label: "Old Label")

      put "/api/v1/integrations/whatsapp_groups/1234567890@g.us", params: {
        whatsapp_group: { label: "New Label" }
      }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["jid"]).to eq("1234567890@g.us")
      expect(body["label"]).to eq("New Label")
      group.reload
      expect(group.label).to eq("New Label")
    end

    it "trims whitespace from label" do
      group = create(:whats_app_group, jid: "1234567890@g.us", name: "Test Group")

      put "/api/v1/integrations/whatsapp_groups/1234567890@g.us", params: {
        whatsapp_group: { label: "  New Label  " }
      }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["label"]).to eq("New Label")
    end

    it "returns 404 when group not found" do
      put "/api/v1/integrations/whatsapp_groups/nonexistent@g.us", params: {
        whatsapp_group: { label: "New Label" }
      }

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/integrations/whatsapp_groups/sync" do
    it "enqueues WhatsAppSyncJob and returns 202" do
      expect {
        post "/api/v1/integrations/whatsapp_groups/sync"
      }.to have_enqueued_job(WhatsAppSyncJob)

      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body["ok"]).to be true
    end
  end
end
