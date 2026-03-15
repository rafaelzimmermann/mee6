require "rails_helper"

RSpec.describe Memories::AgentService do
  let(:service) { described_class.new }
  let(:memory) { create(:memory, max_memories: 3, ttl_hours: 24, max_value_size: 1000) }

  before do
    memory
  end

  describe "#call" do
    context "with operation: 'append'" do
      it "creates a MemoryEntry with the input value" do
        expect do
          service.call(config: { memory_label: memory.label, operation: "append" }, input: "Hello")
        end.to change { memory.memory_entries.count }.by(1)

        entry = memory.memory_entries.last
        expect(entry.value).to eq("Hello")
      end

      it "truncates the input if it exceeds max_value_size" do
        long_input = "a" * 1500
        service.call(config: { memory_label: memory.label, operation: "append" }, input: long_input)

        entry = memory.memory_entries.last
        expect(entry.value.length).to eq(1000)
      end

      it "returns recent memory entries joined by newline" do
        service.call(config: { memory_label: memory.label, operation: "append" }, input: "First")
        service.call(config: { memory_label: memory.label, operation: "append" }, input: "Second")

        result = service.call(config: { memory_label: memory.label, operation: "append" }, input: "Third")
        expect(result).to eq("Third\nSecond\nFirst")
      end

      context "when max_memories is exceeded" do
        it "evicts oldest entries" do
          service.call(config: { memory_label: memory.label, operation: "append" }, input: "First")
          service.call(config: { memory_label: memory.label, operation: "append" }, input: "Second")
          service.call(config: { memory_label: memory.label, operation: "append" }, input: "Third")
          service.call(config: { memory_label: memory.label, operation: "append" }, input: "Fourth")

          memory.reload
          expect(memory.memory_entries.count).to eq(3)
          expect(memory.memory_entries.pluck(:value)).not_to include("First")
          expect(memory.memory_entries.pluck(:value)).to include("Fourth")
        end
      end

      context "when TTL is exceeded" do
        it "excludes entries older than ttl_hours from output" do
          old_entry = memory.memory_entries.create!(value: "Old", created_at: 25.hours.ago)
          service.call(config: { memory_label: memory.label, operation: "append" }, input: "New")

          result = service.call(config: { memory_label: memory.label, operation: "read" }, input: "")
          expect(result).to include("New")
          expect(result).not_to include("Old")
        end
      end
    end

    context "with operation: 'read'" do
      it "does not create a MemoryEntry" do
        expect do
          service.call(config: { memory_label: memory.label, operation: "read" }, input: "Hello")
        end.not_to change { memory.memory_entries.count }
      end

      it "returns existing entries" do
        service.call(config: { memory_label: memory.label, operation: "append" }, input: "Test entry")

        result = service.call(config: { memory_label: memory.label, operation: "read" }, input: "")
        expect(result).to eq("Test entry")
      end
    end

    context "when memory label is not found" do
      it "raises MemoryNotFound" do
        expect do
          service.call(config: { memory_label: "nonexistent", operation: "read" }, input: "")
        end.to raise_error(Memories::AgentService::MemoryNotFound, /No memory with label 'nonexistent'/)
      end
    end
  end
end
