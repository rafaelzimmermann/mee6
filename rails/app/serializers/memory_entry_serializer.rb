class MemoryEntrySerializer < Blueprinter::Base
  identifier :id
  fields :memory_id, :value, :created_at
end
