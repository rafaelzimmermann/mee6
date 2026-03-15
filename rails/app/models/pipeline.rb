class Pipeline < ApplicationRecord
  self.implicit_order_column = "created_at"

  has_many :pipeline_steps, -> { order(:step_index) },
           dependent: :destroy, inverse_of: :pipeline
  has_many :triggers, dependent: :destroy
  has_many :run_records, foreign_key: :pipeline_id, primary_key: :id

  validates :id,   presence: true
  validates :name, presence: true

  accepts_nested_attributes_for :pipeline_steps, allow_destroy: true

  before_validation :assign_id

  scope :ordered, -> { order(:name) }

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end
end