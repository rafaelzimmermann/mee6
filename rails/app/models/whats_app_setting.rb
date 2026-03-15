class WhatsAppSetting < ApplicationRecord
  DEFAULT_ID = "default"

  validates :phone_number, presence: false

  def self.current
    find_or_create_by!(id: DEFAULT_ID) do |s|
      s.phone_number = ""
    end
  end
end