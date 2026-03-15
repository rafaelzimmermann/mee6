class RunRecord < ApplicationRecord
  STATUSES = %w[success error running].freeze

  validates :pipeline_id,   presence: true
  validates :pipeline_name, presence: true
  validates :timestamp,     presence: true
  validates :status,        presence: true, inclusion: { in: STATUSES }

  scope :for_pipeline, ->(pid) { where(pipeline_id: pid) }
  scope :recent,       -> { order(timestamp: :desc) }
  scope :succeeded,    -> { where(status: "success") }
  scope :failed,       -> { where(status: "error") }
end