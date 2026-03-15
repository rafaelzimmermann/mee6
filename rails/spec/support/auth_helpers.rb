module AuthHelpers
  def sign_in_admin
    AdminCredential.find_or_create_by!(id: 1) do |c|
      c.password = "password123"
      c.password_confirmation = "password123"
    end
    post "/api/v1/auth/login", params: { password: "password123" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
