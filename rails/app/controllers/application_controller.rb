class ApplicationController < ActionController::API
  include ActionController::Cookies

  before_action :require_auth

  private

  def require_auth
    unless session[:admin]
      render json: { error: "Unauthorized" }, status: :unauthorized
    end
  end
end