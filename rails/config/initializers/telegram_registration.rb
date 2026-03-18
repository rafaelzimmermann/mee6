module TelegramRegistration
  def self.register_all
    triggers  = Trigger.enabled.tg_types.to_a
    user_ids  = triggers.select(&:telegram_dm?).filter_map { |t| t.config["user_id"] }.uniq
    chat_ids  = triggers.select(&:telegram_chat?).filter_map { |t| t.config["chat_id"] }.uniq

    callback_url = "#{ENV.fetch("RAILS_BASE_URL", "http://localhost:3000")}/webhooks/telegram"

    Rails.logger.info("[TelegramRegistration] Registering monitor — users: #{user_ids.inspect}, chats: #{chat_ids.inspect}")
    Integrations::TelegramClient.new.monitor(
      callback_url:,
      user_ids:,
      chat_ids:
    )
  rescue => e
    Rails.logger.error("[TelegramRegistration] Failed to register monitors: #{e.message}")
  end
end

if !Rails.env.test?
  Rails.application.config.after_initialize do
    TelegramRegistration.register_all
  end
end
