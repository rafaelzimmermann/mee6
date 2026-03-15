class WhatsAppSyncJob < ApplicationJob
  queue_as :default

  def perform
    groups = ::Integrations::WhatsAppClient.new.groups

    groups.each do |group|
      WhatsAppGroup.find_or_initialize_by(jid: group["jid"]).tap do |g|
        g.name = group["name"]
        g.save!
      end
    end
  end
end
