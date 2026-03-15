class Memory < ApplicationRecord
  has_many :memory_entries, dependent: :destroy

  validates :id,             presence: true
  validates :label,          presence: true, uniqueness: true
  validates :max_memories,   numericality: { only_integer: true, greater_than: 0 }
  validates :ttl_hours,      numericality: { only_integer: true, greater_than: 0 }
  validates :max_value_size, numericality: { only_integer: true, greater_than: 0 }

  before_validation :assign_id

  scope :by_label, ->(lbl) { find_by!(label: lbl) }

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end
end