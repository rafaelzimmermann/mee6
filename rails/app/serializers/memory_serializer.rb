class MemorySerializer < Blueprinter::Base
  identifier :id
  fields :label, :max_memories, :ttl_hours, :max_value_size, :created_at, :updated_at
end
