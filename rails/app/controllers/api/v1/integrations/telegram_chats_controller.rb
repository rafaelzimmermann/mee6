module Api::V1::Integrations
  class TelegramChatsController < ApplicationController
    before_action :set_chat, only: [:update]

    def index
      render json: TelegramChatSerializer.render(TelegramChat.all.order(:title))
    end

    def update
      if @chat.update(label: params.dig(:telegram_chat, :label).to_s.strip)
        render json: TelegramChatSerializer.render(@chat)
      else
        render json: { errors: @chat.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def set_chat
      @chat = TelegramChat.find(params[:id])
    end
  end
end
