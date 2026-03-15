module Api
  module V1
    class AuthController < ApplicationController
      skip_before_action :require_auth, only: [:setup_required, :setup, :login]

      # GET /api/v1/auth/setup_required
      # Returns { setup_required: true } when no admin password has been set yet.
      # The React app checks this on mount to decide whether to show /setup.
      def setup_required
        render json: { setup_required: !AdminCredential.configured? }
      end

      # POST /api/v1/auth/setup
      # Body: { password:, password_confirmation: }
      # Only succeeds when no credential exists yet (first run).
      def setup
        if AdminCredential.configured?
          render json: { error: "Already configured" }, status: :forbidden
          return
        end

        AdminCredential.create!(
          password:              params[:password],
          password_confirmation: params[:password_confirmation]
        )
        session[:admin] = true
        render json: { ok: true }
      rescue ActiveRecord::RecordInvalid => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/auth/login
      # Body: { password: }
      def login
        credential = AdminCredential.instance
        if credential&.authenticate(params[:password])
          session[:admin] = true
          render json: { ok: true }
        else
          render json: { error: "Invalid password" }, status: :unauthorized
        end
      end

      # DELETE /api/v1/auth/logout
      def logout
        session.delete(:admin)
        head :ok
      end

      # GET /api/v1/auth/me
      # Returns 200 when the session is valid. The React app uses this to
      # distinguish "not logged in" from "needs setup".
      def me
        render json: { authenticated: true }
      end

      # PUT /api/v1/auth/password
      # Body: { current_password:, new_password:, new_password_confirmation: }
      def change_password
        credential = AdminCredential.instance
        unless credential&.authenticate(params[:current_password])
          render json: { error: "Current password is incorrect" }, status: :unauthorized
          return
        end

        credential.update!(
          password:              params[:new_password],
          password_confirmation: params[:new_password_confirmation]
        )
        render json: { ok: true }
      rescue ActiveRecord::RecordInvalid => e
        render json: { error: e.message }, status: :unprocessable_entity
      end
    end
  end
end