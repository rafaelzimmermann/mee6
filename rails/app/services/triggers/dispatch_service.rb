module Triggers
  class DispatchService
    def call(type:, sender: nil, chat_jid: nil, text:)
      triggers = find_matching_triggers(type:, sender:, chat_jid:)
      input = build_input(type:, sender:, chat_jid:, text:)
      triggers.each do |trigger|
        PipelineJob.perform_later(trigger.pipeline_id, input)
      end
    end

    private

    def find_matching_triggers(type:, sender:, chat_jid:)
      case type.to_s
      when "dm"
        phone = normalise_phone(sender.to_s)
        Trigger.enabled.whatsapp.select do |t|
          t.config["phone"].present? &&
            normalise_phone(t.config["phone"]) == phone
        end
      when "group"
        Trigger.enabled.wa_group.select do |t|
          t.config["group_jid"] == chat_jid
        end
      else
        []
      end
    end

    def build_input(type:, sender:, chat_jid:, text:)
      header = case type.to_s
               when "dm"    then "[From: +#{normalise_phone(sender)}]"
               when "group" then "[Group: #{chat_jid} | From: +#{normalise_phone(sender)}]"
               end
      header ? "#{header}\n#{text}" : text
    end

    def normalise_phone(raw)
      # Strip JID server part (after @) and device suffix (after :) before extracting digits.
      # e.g. "34650093977:5@s.whatsapp.net" -> "34650093977"
      user_part = raw.to_s.split("@").first.to_s.split(":").first
      user_part.gsub(/\D/, "")
    end
  end
end
