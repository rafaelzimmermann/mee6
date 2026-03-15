module Api::V1::Integrations
  class CalendarsController < ApplicationController
    before_action :set_calendar, only: [:destroy]

    def index
      render json: CalendarSerializer.render(Calendar.all.order(:label))
    end

    def create
      @calendar = Calendar.new(calendar_params)
      if @calendar.save
        render json: CalendarSerializer.render(@calendar), status: :created
      else
        render json: { errors: @calendar.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def destroy
      @calendar.destroy!
      head :no_content
    end

    private

    def set_calendar
      @calendar = Calendar.find(params[:id])
    end

    def calendar_params
      params.require(:calendar).permit(:label, :calendar_id, :credentials_file)
    end
  end
end
