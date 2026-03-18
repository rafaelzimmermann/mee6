class Trigger < ApplicationRecord
  belongs_to :pipeline

  enum :trigger_type, { cron: 0, whatsapp: 1, wa_group: 2, telegram_dm: 3, telegram_chat: 4 }, prefix: false

  validates :id,           presence: true
  validates :trigger_type, presence: true
  validates :cron_expr,    presence: true, if: :cron?
  validates :pipeline_id,  presence: true
  validates :enabled,      inclusion: { in: [true, false] }

  before_validation :assign_id

  scope :enabled,       -> { where(enabled: true) }
  scope :cron_type,     -> { cron }
  scope :whatsapp,      -> { where(trigger_type: :whatsapp) }
  scope :wa_group,      -> { where(trigger_type: :wa_group) }
  scope :wa_types,      -> { where(trigger_type: [:whatsapp, :wa_group]) }
  scope :telegram_dm,   -> { where(trigger_type: :telegram_dm) }
  scope :telegram_chat, -> { where(trigger_type: :telegram_chat) }
  scope :tg_types,      -> { where(trigger_type: [:telegram_dm, :telegram_chat]) }

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end
end