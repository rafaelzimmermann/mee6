module Memories
  class MemoryService
    def store(label, value)
      memory = Memory.find_by!(label: label)

      truncated = value.to_s.first(memory.max_value_size)

      MemoryEntry.transaction do
        memory.memory_entries.create!(value: truncated)
        enforce_max_memories(memory)
      end
    end

    def read(label, n = 10)
      memory = Memory.find_by!(label: label)
      cutoff = memory.ttl_hours.hours.ago

      memory
        .memory_entries
        .where("created_at > ?", cutoff)
        .order(created_at: :desc)
        .limit(n)
        .pluck(:value)
    end

    private

    def enforce_max_memories(memory)
      total = memory.memory_entries.count
      excess = total - memory.max_memories
      return unless excess > 0

      oldest_ids = memory
        .memory_entries
        .order(created_at: :asc)
        .limit(excess)
        .pluck(:id)

      MemoryEntry.where(id: oldest_ids).delete_all
    end
  end
end
