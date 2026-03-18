class TelegramSyncJob < ApplicationJob
  queue_as :default

  def perform
    # Telegram bots don't have a "list chats" API; chats are discovered as messages arrive.
    # This job is a placeholder for future chat discovery via stored registration data.
    Rails.logger.info("[TelegramSyncJob] No-op: Telegram chats are registered via triggers")
  end
end
