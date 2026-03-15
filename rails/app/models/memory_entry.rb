class MemoryEntry < ApplicationRecord
  belongs_to :memory

  validates :memory_id, presence: true
  validates :value,     presence: true

  scope :recent,       -> { order(created_at: :desc) }
  scope :within_ttl,   ->(hours) { where("created_at > ?", hours.hours.ago) }
end