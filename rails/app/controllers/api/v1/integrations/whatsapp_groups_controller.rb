module Api::V1::Integrations
  class WhatsappGroupsController < ApplicationController
    before_action :set_group, only: [:update]

    def index
      render json: WhatsAppGroupSerializer.render(WhatsAppGroup.all.order(:name))
    end

    def update
      if @group.update(label: params.dig(:whatsapp_group, :label).to_s.strip)
        render json: WhatsAppGroupSerializer.render(@group)
      else
        render json: { errors: @group.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def sync
      WhatsAppSyncJob.perform_later
      render json: { ok: true }, status: :accepted
    end

    private

    def set_group
      @group = WhatsAppGroup.find(params[:id])
    end
  end
end
