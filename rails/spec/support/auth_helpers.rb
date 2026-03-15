module AuthHelpers
  def sign_in_admin
    unless AdminCredential.instance
      AdminCredential.create!(password: "password123", password_confirmation: "password123")
    end
    post "/api/v1/auth/login", params: { password: "password123" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
