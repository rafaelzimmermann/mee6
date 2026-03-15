require "rails_helper"

RSpec.describe "Api::V1::RunRecords", type: :request do
  before { sign_in_admin }

  describe "GET /api/v1/run_records" do
    it "returns all run records most-recent first" do
      pipeline = create(:pipeline)
      create(:run_record, pipeline_id: pipeline.id, status: "success", timestamp: 2.days.ago)
      create(:run_record, pipeline_id: pipeline.id, status: "error", timestamp: 1.day.ago)
      create(:run_record, pipeline_id: "other-pipeline", status: "success", timestamp: 1.hour.ago)

      get "/api/v1/run_records"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to be_an(Array)
      expect(body.length).to eq(3)
      expect(body[0]["pipeline_id"]).to eq("other-pipeline")
      expect(body[1]["status"]).to eq("error")
      expect(body[2]["status"]).to eq("success")
    end

    it "returns only records for specific pipeline when pipeline_id is provided" do
      pipeline1 = create(:pipeline)
      pipeline2 = create(:pipeline)
      create(:run_record, pipeline_id: pipeline1.id, status: "success")
      create(:run_record, pipeline_id: pipeline2.id, status: "error")

      get "/api/v1/run_records?pipeline_id=#{pipeline1.id}"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.length).to eq(1)
      expect(body.first["pipeline_id"]).to eq(pipeline1.id)
      expect(body.first["status"]).to eq("success")
    end
  end
end
