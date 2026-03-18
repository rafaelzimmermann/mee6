class TelegramChat < ApplicationRecord
  self.primary_key = "chat_id"

  validates :chat_id,   presence: true
  validates :title,     presence: true
  validates :chat_type, presence: true

  scope :labeled, -> { where.not(label: ["", nil]) }
end
