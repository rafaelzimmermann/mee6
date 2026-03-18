module Api
  module V1
    module Integrations
      class TelegramController < BaseController
        def status
          render json: telegram_client.status
        rescue ::Integrations::TelegramClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        def connect
          token = TelegramSetting.current.bot_token
          if token.blank?
            render json: { error: "Bot token not configured" }, status: :unprocessable_entity
            return
          end
          telegram_client.connect(bot_token: token)
          head :accepted
        rescue ::Integrations::TelegramClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        def disconnect
          telegram_client.disconnect
          head :ok
        rescue ::Integrations::TelegramClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        def contacts
          render json: telegram_client.contacts
        rescue ::Integrations::TelegramClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        def settings
          render json: { bot_token: TelegramSetting.current.bot_token }
        end

        def update_settings
          TelegramSetting.current.update!(settings_params)
          TelegramRegistration.register_all
          render json: { bot_token: TelegramSetting.current.bot_token }
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        private

        def telegram_client
          @telegram_client ||= ::Integrations::TelegramClient.new
        end

        def settings_params
          params.permit(:bot_token)
        end
      end
    end
  end
end
