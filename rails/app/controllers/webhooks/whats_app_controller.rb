module Webhooks
  class WhatsAppController < ApplicationController
    before_action :verify_secret

    def receive
      Triggers::DispatchService.new.call(
        type:     payload[:type],
        sender:   payload[:sender],
        chat_jid: payload[:chat_jid],
        text:     payload[:text].to_s
      )
      head :ok
    end

    private

    def verify_secret
      provided = request.headers["X-Webhook-Secret"]
      expected = ENV.fetch("WEBHOOK_SECRET", "changeme")
      unless ActiveSupport::SecurityUtils.secure_compare(provided.to_s, expected)
        render json: { error: "Unauthorized" }, status: :unauthorized
      end
    end

    def payload
      @payload ||= params.permit(:type, :sender, :chat_jid, :text).to_h.with_indifferent_access
    end
  end
end
