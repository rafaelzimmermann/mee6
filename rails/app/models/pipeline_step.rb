class PipelineStep < ApplicationRecord
  belongs_to :pipeline

  validates :step_index,  presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :agent_type,  presence: true
  validates :config,      presence: true
  validates :step_index,  uniqueness: { scope: :pipeline_id }

  AGENT_TYPES = %w[
    llm_agent browser_agent calendar_agent
    whatsapp_agent whatsapp_group_send
    telegram_send
    memory_agent debug_agent
  ].freeze

  validates :agent_type, inclusion: { in: AGENT_TYPES }

  scope :ordered, -> { order(:step_index) }
end