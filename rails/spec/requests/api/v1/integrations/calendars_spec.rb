require "rails_helper"

RSpec.describe "Api::V1::Integrations::Calendars", type: :request do
  before { sign_in_admin }

  describe "GET /api/v1/integrations/calendars" do
    it "returns array of calendars" do
      create(:calendar, label: "Work", calendar_id: "work@example.com", credentials_file: "work.json")
      create(:calendar, label: "Personal", calendar_id: "personal@example.com", credentials_file: "personal.json")

      get "/api/v1/integrations/calendars"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to be_an(Array)
      expect(body.length).to eq(2)
      expect(body.first["label"]).to eq("Personal")
      expect(body.last["label"]).to eq("Work")
    end

    it "returns empty array when no calendars exist" do
      get "/api/v1/integrations/calendars"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq([])
    end
  end

  describe "POST /api/v1/integrations/calendars" do
    it "creates calendar with valid params" do
      params = {
        calendar: {
          label: "Work",
          calendar_id: "work@example.com",
          credentials_file: "work.json"
        }
      }

      post "/api/v1/integrations/calendars", params: params

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["label"]).to eq("Work")
      expect(body["calendar_id"]).to eq("work@example.com")
      expect(body["credentials_file"]).to eq("work.json")
      expect(Calendar.find_by(label: "Work")).to be_present
    end

    it "returns 422 with missing required fields" do
      params = { calendar: { label: "Work" } }

      post "/api/v1/integrations/calendars", params: params

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body["errors"]).to be_present
    end

    it "returns 422 when missing calendar_id" do
      params = {
        calendar: {
          label: "Work",
          credentials_file: "work.json"
        }
      }

      post "/api/v1/integrations/calendars", params: params

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body["errors"]).to include("Calendar can't be blank")
    end

    it "returns 422 when missing credentials_file" do
      params = {
        calendar: {
          label: "Work",
          calendar_id: "work@example.com"
        }
      }

      post "/api/v1/integrations/calendars", params: params

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body["errors"]).to include("Credentials file can't be blank")
    end
  end

  describe "DELETE /api/v1/integrations/calendars/:id" do
    it "destroys calendar" do
      calendar = create(:calendar)

      expect {
        delete "/api/v1/integrations/calendars/#{calendar.id}"
      }.to change { Calendar.count }.by(-1)

      expect(response).to have_http_status(:no_content)
      expect(Calendar.find_by(id: calendar.id)).to be_nil
    end

    it "returns 404 when calendar not found" do
      delete "/api/v1/integrations/calendars/nonexistent"

      expect(response).to have_http_status(:not_found)
    end
  end
end
