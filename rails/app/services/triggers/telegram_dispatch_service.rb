module Triggers
  class TelegramDispatchService
    def call(type:, sender: nil, chat_id: nil, text:)
      triggers = find_matching_triggers(type:, sender:, chat_id:)
      input = build_input(type:, sender:, chat_id:, text:)
      triggers.each do |trigger|
        PipelineJob.perform_later(trigger.pipeline_id, input)
      end
    end

    private

    def find_matching_triggers(type:, sender:, chat_id:)
      case type.to_s
      when "telegram_dm"
        Trigger.enabled.telegram_dm.select do |t|
          t.config["user_id"].present? &&
            t.config["user_id"].to_s == sender.to_s
        end
      when "telegram_chat"
        Trigger.enabled.telegram_chat.select do |t|
          t.config["chat_id"].to_s == chat_id.to_s
        end
      else
        []
      end
    end

    def build_input(type:, sender:, chat_id:, text:)
      header = case type.to_s
               when "telegram_dm"   then "[Telegram From: #{sender}]"
               when "telegram_chat" then "[Telegram Chat: #{chat_id} | From: #{sender}]"
               end
      header ? "#{header}\n#{text}" : text
    end
  end
end
