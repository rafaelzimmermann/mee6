require "rails_helper"

RSpec.describe "Api::V1::Pipelines", type: :request do
  before { sign_in_admin }

  describe "GET /api/v1/pipelines" do
    it "returns [] on a fresh database" do
      get "/api/v1/pipelines"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq([])
    end

    it "returns array of pipelines without steps" do
      pipeline = create(:pipeline)
      get "/api/v1/pipelines"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to be_an(Array)
      expect(body.length).to eq(1)
      expect(body.first["id"]).to eq(pipeline.id)
      expect(body.first["name"]).to eq(pipeline.name)
      expect(body.first).not_to have_key("steps")
    end
  end

  describe "GET /api/v1/pipelines/:id" do
    it "returns pipeline with steps" do
      pipeline = create(:pipeline)
      create(:pipeline_step, pipeline: pipeline, step_index: 0, agent_type: "llm_agent", config: { prompt: "test" })
      create(:pipeline_step, pipeline: pipeline, step_index: 1, agent_type: "debug_agent", config: { debug: true })

      get "/api/v1/pipelines/#{pipeline.id}"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["id"]).to eq(pipeline.id)
      expect(body["steps"]).to be_an(Array)
      expect(body["steps"].length).to eq(2)
      expect(body["steps"][0]["step_index"]).to eq(0)
      expect(body["steps"][1]["step_index"]).to eq(1)
    end

    it "returns 404 for nonexistent pipeline" do
      get "/api/v1/pipelines/nonexistent"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/pipelines" do
    it "creates pipeline and steps" do
      post "/api/v1/pipelines", params: {
        pipeline: {
          name: "Test Pipeline",
          steps: [
            { step_index: 0, agent_type: "llm_agent", config: { prompt: "test" } },
            { step_index: 1, agent_type: "debug_agent", config: { debug: true } }
          ]
        }
      }
      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["id"]).to be_present
      expect(body["name"]).to eq("Test Pipeline")
      expect(body["steps"]).to be_an(Array)
      expect(body["steps"].length).to eq(2)

      created_pipeline = Pipeline.find(body["id"])
      expect(created_pipeline.pipeline_steps.count).to eq(2)
    end

    it "returns 422 when name is missing" do
      post "/api/v1/pipelines", params: {
        pipeline: {
          steps: [{ step_index: 0, agent_type: "llm_agent", config: { test: true } }]
        }
      }
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body["error"]).to be_an(Array)
      expect(body["error"].join).to match(/name/i)
    end
  end

  describe "PUT /api/v1/pipelines/:id" do
    let!(:pipeline) { create(:pipeline, name: "Old Name") }

    it "updates pipeline and replaces all steps with new steps array" do
      create(:pipeline_step, pipeline: pipeline, step_index: 0, agent_type: "llm_agent", config: { old: true })

      put "/api/v1/pipelines/#{pipeline.id}", params: {
        pipeline: {
          name: "New Name",
          steps: [
            { step_index: 0, agent_type: "debug_agent", config: { new: "true" } }
          ]
        }
      }
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["name"]).to eq("New Name")
      expect(body["steps"]).to be_an(Array)
      expect(body["steps"].length).to eq(1)
      expect(body["steps"][0]["config"]).to eq({ "new" => "true" })
    end

    it "updates pipeline without changing steps when steps key is absent" do
      create(:pipeline_step, pipeline: pipeline, step_index: 0, agent_type: "llm_agent", config: { test: true })

      put "/api/v1/pipelines/#{pipeline.id}", params: {
        pipeline: { name: "Updated Name" }
      }
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["name"]).to eq("Updated Name")
      expect(body["steps"]).to be_an(Array)
      expect(body["steps"].length).to eq(1)
      expect(body["steps"][0]["config"]).to eq({ "test" => true })
    end

    it "returns 404 for nonexistent pipeline" do
      put "/api/v1/pipelines/nonexistent", params: { pipeline: { name: "Test" } }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/pipelines/:id" do
    it "deletes pipeline and cascade-deletes steps" do
      pipeline = create(:pipeline)
      create(:pipeline_step, pipeline: pipeline, step_index: 0, agent_type: "llm_agent", config: { test: true })
      step_id = pipeline.pipeline_steps.first.id

      delete "/api/v1/pipelines/#{pipeline.id}"
      expect(response).to have_http_status(:no_content)

      expect { Pipeline.find(pipeline.id) }.to raise_error(ActiveRecord::RecordNotFound)
      expect { PipelineStep.find(step_id) }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "returns 404 for nonexistent pipeline" do
      delete "/api/v1/pipelines/nonexistent"
      expect(response).to have_http_status(:not_found)
    end
  end
end
