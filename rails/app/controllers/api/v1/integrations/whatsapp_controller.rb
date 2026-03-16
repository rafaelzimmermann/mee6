module Api
  module V1
    module Integrations
      class WhatsappController < BaseController
        def status
          data = whatsapp_client.status
          render json: data
        rescue ::Integrations::WhatsAppClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        def connect
          whatsapp_client.connect
          head :accepted
        rescue ::Integrations::WhatsAppClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        def disconnect
          whatsapp_client.disconnect
          head :ok
        rescue ::Integrations::WhatsAppClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        def groups
          data = whatsapp_client.groups
          upsert_groups(data)
          render json: data
        rescue ::Integrations::WhatsAppClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        def settings
          render json: { phone_number: WhatsAppSetting.current.phone_number }
        end

        def update_settings
          WhatsAppSetting.current.update!(settings_params)
          WhatsAppRegistration.register_all
          render json: { phone_number: WhatsAppSetting.current.phone_number }
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        private

        def whatsapp_client
          @whatsapp_client ||= ::Integrations::WhatsAppClient.new
        end

        def settings_params
          params.permit(:phone_number)
        end

        def upsert_groups(groups_data)
          groups_data.each do |g|
            WhatsAppGroup.find_or_initialize_by(jid: g["jid"]).tap do |record|
              record.name = g["name"]
              record.save!
            end
          end
        end
      end
    end
  end
end
