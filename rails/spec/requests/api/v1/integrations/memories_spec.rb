require "rails_helper"

RSpec.describe "Api::V1::Integrations::Memories", type: :request do
  before { sign_in_admin }
  before { MemoryEntry.delete_all; Memory.delete_all }

  describe "GET /api/v1/integrations/memories" do
    it "returns array of memories" do
      create(:memory, label: "notes", max_memories: 10, ttl_hours: 24, max_value_size: 500)
      create(:memory, label: "logs", max_memories: 100, ttl_hours: 48, max_value_size: 1000)

      get "/api/v1/integrations/memories"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to be_an(Array)
      expect(body.length).to eq(2)
      expect(body.first["label"]).to eq("logs")
      expect(body.last["label"]).to eq("notes")
    end

    it "returns empty array when no memories exist" do
      get "/api/v1/integrations/memories"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq([])
    end
  end

  describe "GET /api/v1/integrations/memories/:label" do
    it "returns a single memory" do
      memory = create(:memory, label: "notes")

      get "/api/v1/integrations/memories/notes"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["id"]).to eq(memory.id)
      expect(body["label"]).to eq("notes")
    end

    it "returns 404 when memory not found" do
      get "/api/v1/integrations/memories/nonexistent"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/integrations/memories" do
    it "creates memory with valid params" do
      params = {
        memory: {
          label: "notes",
          max_memories: 10,
          ttl_hours: 24,
          max_value_size: 500
        }
      }

      post "/api/v1/integrations/memories", params: params

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["label"]).to eq("notes")
      expect(body["max_memories"]).to eq(10)
      expect(body["ttl_hours"]).to eq(24)
      expect(body["max_value_size"]).to eq(500)
      expect(Memory.find_by(label: "notes")).to be_present
    end

    it "returns 422 with duplicate label" do
      create(:memory, label: "notes")

      params = {
        memory: {
          label: "notes",
          max_memories: 10,
          ttl_hours: 24,
          max_value_size: 500
        }
      }

      post "/api/v1/integrations/memories", params: params

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body["errors"]).to include("Label has already been taken")
    end

    it "creates memory with only label using defaults" do
      params = { memory: { label: "notes" } }

      post "/api/v1/integrations/memories", params: params

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["label"]).to eq("notes")
      expect(body["max_memories"]).to eq(100)
      expect(body["ttl_hours"]).to eq(24)
      expect(body["max_value_size"]).to eq(1000)
    end
  end

  describe "DELETE /api/v1/integrations/memories/:label" do
    it "destroys memory and its entries" do
      memory = create(:memory, label: "notes")
      memory.memory_entries.create!(value: "entry1")
      memory.memory_entries.create!(value: "entry2")

      expect {
        delete "/api/v1/integrations/memories/notes"
      }.to change { Memory.count }.by(-1)
       .and change { MemoryEntry.count }.by(-2)

      expect(response).to have_http_status(:no_content)
      expect(Memory.find_by(id: memory.id)).to be_nil
    end

    it "returns 404 when memory not found" do
      delete "/api/v1/integrations/memories/nonexistent"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/integrations/memories/:label/entries" do
    it "returns last N entries" do
      memory = create(:memory, label: "notes")
      memory.memory_entries.create!(value: "entry1", created_at: 3.days.ago)
      memory.memory_entries.create!(value: "entry2", created_at: 2.days.ago)
      memory.memory_entries.create!(value: "entry3", created_at: 1.day.ago)

      get "/api/v1/integrations/memories/notes/entries", params: { n: 2 }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to be_an(Array)
      expect(body.length).to eq(2)
      expect(body.first["value"]).to eq("entry3")
      expect(body.last["value"]).to eq("entry2")
    end

    it "defaults to 20 entries" do
      memory = create(:memory, label: "notes")
      25.times { |i| memory.memory_entries.create!(value: "entry#{i}") }

      get "/api/v1/integrations/memories/notes/entries"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.length).to eq(20)
    end

    it "clamps n to 500 maximum" do
      memory = create(:memory, label: "notes")
      600.times { |i| memory.memory_entries.create!(value: "entry#{i}") }

      get "/api/v1/integrations/memories/notes/entries", params: { n: 1000 }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.length).to eq(500)
    end

    it "clamps n to 1 minimum" do
      memory = create(:memory, label: "notes")
      5.times { |i| memory.memory_entries.create!(value: "entry#{i}") }

      get "/api/v1/integrations/memories/notes/entries", params: { n: 0 }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.length).to eq(1)
    end

    it "returns 404 when memory not found" do
      get "/api/v1/integrations/memories/nonexistent/entries"

      expect(response).to have_http_status(:not_found)
    end
  end
end
