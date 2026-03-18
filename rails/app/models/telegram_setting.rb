class TelegramSetting < ApplicationRecord
  DEFAULT_ID = "default"

  def self.current
    find_or_create_by!(id: DEFAULT_ID) do |s|
      s.bot_token = ""
    end
  end
end
