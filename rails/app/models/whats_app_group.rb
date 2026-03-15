class WhatsAppGroup < ApplicationRecord
  self.primary_key = "jid"

  validates :jid,  presence: true
  validates :name, presence: true

  scope :labeled, -> { where.not(label: ["", nil]) }
end