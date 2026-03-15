module Api
  module V1
    class BaseController < ApplicationController
      rescue_from ActiveRecord::RecordNotFound,       with: :not_found
      rescue_from ActiveRecord::RecordInvalid,        with: :unprocessable
      rescue_from ActionController::ParameterMissing, with: :bad_request

      private

      def not_found(e)
        render json: { error: e.message }, status: :not_found
      end

      def unprocessable(e)
        render json: { error: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def bad_request(e)
        render json: { error: e.message }, status: :bad_request
      end
    end
  end
end
