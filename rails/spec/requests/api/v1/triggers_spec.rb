require "rails_helper"

RSpec.describe "Api::V1::Triggers", type: :request do
  before { sign_in_admin }

  describe "GET /api/v1/triggers" do
    it "returns all triggers" do
      create(:trigger, trigger_type: :cron)
      create(:trigger, trigger_type: :whatsapp)

      get "/api/v1/triggers"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to be_an(Array)
      expect(body.length).to eq(2)
    end

    it "returns only triggers for specific pipeline when pipeline_id is provided" do
      pipeline1 = create(:pipeline)
      pipeline2 = create(:pipeline)
      create(:trigger, pipeline: pipeline1, trigger_type: :cron)
      create(:trigger, pipeline: pipeline2, trigger_type: :whatsapp)

      get "/api/v1/triggers?pipeline_id=#{pipeline1.id}"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.length).to eq(1)
      expect(body.first["pipeline_id"]).to eq(pipeline1.id)
    end
  end

  describe "POST /api/v1/triggers" do
    it "creates trigger" do
      pipeline = create(:pipeline)
      post "/api/v1/triggers", params: {
        trigger: {
          pipeline_id: pipeline.id,
          trigger_type: :cron,
          cron_expr: "0 8 * * *",
          enabled: true,
          config: { test: true }
        }
      }
      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["pipeline_id"]).to eq(pipeline.id)
      expect(body["trigger_type"]).to eq("cron")
      expect(body["enabled"]).to be(true)
    end

    it "returns 422 when cron type without cron_expr" do
      pipeline = create(:pipeline)
      post "/api/v1/triggers", params: {
        trigger: {
          pipeline_id: pipeline.id,
          trigger_type: :cron,
          enabled: true
        }
      }
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body["error"]).to be_an(Array)
      expect(body["error"].join).to match(/cron/i)
    end
  end

  describe "PATCH /api/v1/triggers/:id/toggle" do
    let!(:trigger) { create(:trigger, enabled: true) }

    it "flips enabled from true to false" do
      patch "/api/v1/triggers/#{trigger.id}/toggle"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["enabled"]).to be(false)

      trigger.reload
      expect(trigger.enabled).to be(false)
    end

    it "flips enabled from false to true" do
      trigger.update!(enabled: false)
      patch "/api/v1/triggers/#{trigger.id}/toggle"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["enabled"]).to be(true)

      trigger.reload
      expect(trigger.enabled).to be(true)
    end

    it "returns 404 for nonexistent trigger" do
      patch "/api/v1/triggers/nonexistent/toggle"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/triggers/:id/run_now" do
    let!(:trigger) { create(:trigger) }

    it "enqueues PipelineJob and returns 200" do
      expect(PipelineJob).to receive(:perform_later).with(trigger.pipeline_id)
      post "/api/v1/triggers/#{trigger.id}/run_now"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["ok"]).to be(true)
    end
  end

  describe "DELETE /api/v1/triggers/:id" do
    it "deletes trigger" do
      trigger = create(:trigger)

      delete "/api/v1/triggers/#{trigger.id}"
      expect(response).to have_http_status(:no_content)

      expect { Trigger.find(trigger.id) }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "returns 404 for nonexistent trigger" do
      delete "/api/v1/triggers/nonexistent"
      expect(response).to have_http_status(:not_found)
    end
  end
end
