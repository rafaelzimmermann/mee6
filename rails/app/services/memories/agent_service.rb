module Memories
  class AgentService
    class MemoryNotFound < StandardError; end

    def call(config:, input:)
      memory = Memory.find_by!(label: config[:memory_label])

      if config[:operation] == "append"
        memory.memory_entries.create!(value: input.to_s.slice(0, memory.max_value_size))
        evict(memory)
      end

      memory.memory_entries
            .within_ttl(memory.ttl_hours)
            .recent
            .limit(memory.max_memories)
            .pluck(:value)
            .join("\n")
    rescue ActiveRecord::RecordNotFound
      raise MemoryNotFound, "No memory with label '#{config[:memory_label]}'"
    end

    private

    def evict(memory)
      excess_ids = memory.memory_entries
                         .order(created_at: :desc)
                         .offset(memory.max_memories)
                         .pluck(:id)
      MemoryEntry.where(id: excess_ids).delete_all if excess_ids.any?
    end
  end
end
