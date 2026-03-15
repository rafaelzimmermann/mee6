module Triggers
  class DispatchService
    def call(type:, sender: nil, chat_jid: nil, text:)
      triggers = find_matching_triggers(type:, sender:, chat_jid:)
      triggers.each do |trigger|
        PipelineJob.perform_later(trigger.pipeline_id, text)
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

    def normalise_phone(raw)
      digits = raw.gsub(/\D/, "")
      digits
    end
  end
end
