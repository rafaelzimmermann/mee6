require "rails_helper"

RSpec.describe Memories::MemoryService, type: :service do
  let(:service) { described_class.new }
  let(:memory) { create(:memory, max_memories: 10, ttl_hours: 24, max_value_size: 100) }

  describe "#store" do
    it "creates a MemoryEntry with the input value" do
      expect {
        service.store(memory.label, "Hello World")
      }.to change { memory.memory_entries.count }.by(1)

      entry = memory.memory_entries.last
      expect(entry.value).to eq("Hello World")
    end

    it "truncates values longer than max_value_size" do
      long_value = "a" * 200
      service.store(memory.label, long_value)

      entry = memory.memory_entries.last
      expect(entry.value.length).to eq(100)
      expect(entry.value).to eq("a" * 100)
    end

    it "enforces max_memories: deletes oldest entries when over the limit" do
      memory.update!(max_memories: 5)

      6.times { |i| service.store(memory.label, "entry#{i}") }

      memory.reload
      expect(memory.memory_entries.count).to eq(5)
      values = memory.memory_entries.order(:created_at).pluck(:value)
      expect(values).not_to include("entry0")
      expect(values).to include("entry5")
    end

    it "keeps most recent entries when max_memories is exceeded" do
      memory.update!(max_memories: 3)

      11.times { |i| service.store(memory.label, "entry#{i}") }

      memory.reload
      expect(memory.memory_entries.count).to eq(3)
      values = memory.memory_entries.order(:created_at).pluck(:value)
      expect(values).to eq(["entry8", "entry9", "entry10"])
    end

    it "raises ActiveRecord::RecordNotFound when label does not exist" do
      expect {
        service.store("nonexistent", "value")
      }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "stores values within transaction" do
      memory.update!(max_memories: 1)

      service.store(memory.label, "first")
      expect {
        service.store(memory.label, "second")
      }.to change { MemoryEntry.count }.by(0)

      memory.reload
      expect(memory.memory_entries.count).to eq(1)
      expect(memory.memory_entries.last.value).to eq("second")
    end
  end

  describe "#read" do
    before do
      memory.memory_entries.create!(value: "entry1", created_at: 3.hours.ago)
      memory.memory_entries.create!(value: "entry2", created_at: 2.hours.ago)
      memory.memory_entries.create!(value: "entry3", created_at: 1.hour.ago)
    end

    it "returns last n entries, newest first" do
      result = service.read(memory.label, 2)
      expect(result).to be_an(Array)
      expect(result.length).to eq(2)
      expect(result[0]).to eq("entry3")
      expect(result[1]).to eq("entry2")
    end

    it "defaults to n=10" do
      15.times { |i| memory.memory_entries.create!(value: "extra#{i}") }
      result = service.read(memory.label)
      expect(result.length).to eq(10)
      expect(result[0]).to eq(memory.memory_entries.order(created_at: :desc).first.value)
    end

    it "excludes entries older than ttl_hours" do
      memory.update!(ttl_hours: 1)
      memory.memory_entries.create!(value: "entry4", created_at: 30.minutes.ago)

      result = service.read(memory.label)
      expect(result).not_to include("entry1")
      expect(result).not_to include("entry2")
      expect(result).to include("entry4")
    end

    it "returns empty array when all entries are expired" do
      memory.update!(ttl_hours: 1)
      memory.memory_entries.update_all(created_at: 2.hours.ago)

      result = service.read(memory.label)
      expect(result).to eq([])
    end

    it "returns empty array when no entries exist" do
      memory.memory_entries.destroy_all

      result = service.read(memory.label)
      expect(result).to eq([])
    end

    it "raises ActiveRecord::RecordNotFound when label does not exist" do
      expect {
        service.read("nonexistent")
      }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "handles n greater than available entries" do
      result = service.read(memory.label, 100)
      expect(result.length).to eq(3)
    end
  end

  describe "integration: store and read" do
    it "stores and retrieves values correctly" do
      service.store(memory.label, "first")
      service.store(memory.label, "second")
      service.store(memory.label, "third")

      result = service.read(memory.label, 3)
      expect(result).to eq(["third", "second", "first"])
    end

    it "respects TTL when reading stored values" do
      memory.update!(ttl_hours: 1)

      service.store(memory.label, "old")
      memory.memory_entries.update_all(created_at: 2.hours.ago)
      service.store(memory.label, "new")

      result = service.read(memory.label)
      expect(result).to eq(["new"])
    end

    it "respects max_memories when storing" do
      memory.update!(max_memories: 5)

      7.times { |i| service.store(memory.label, "entry#{i}") }

      result = service.read(memory.label)
      expect(result.length).to eq(5)
      expect(result).not_to include("entry0")
      expect(result).not_to include("entry1")
    end
  end
end
