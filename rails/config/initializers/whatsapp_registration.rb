module WhatsAppRegistration
  def self.register_all
    triggers = Trigger.enabled.wa_types.to_a
    return if triggers.empty?

    phones     = triggers.select(&:whatsapp?).filter_map { |t| t.config["phone"] }.uniq
    group_jids = triggers.select(&:wa_group?).filter_map { |t| t.config["group_jid"] }.uniq

    callback_url = "#{ENV.fetch("RAILS_BASE_URL", "http://localhost:3000")}/webhooks/whatsapp"

    Integrations::WhatsAppClient.new.monitor(
      callback_url:,
      phones:,
      group_jids:
    )
  rescue => e
    Rails.logger.error("[WhatsAppRegistration] Failed to register monitors: #{e.message}")
  end
end

if !Rails.env.test?
  Rails.application.config.after_initialize do
    WhatsAppRegistration.register_all
  end
end
