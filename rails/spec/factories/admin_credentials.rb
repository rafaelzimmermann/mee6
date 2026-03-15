FactoryBot.define do
  factory :admin_credential do
    password { "password123" }
    password_confirmation { "password123" }
  end
end