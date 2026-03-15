FactoryBot.define do
  factory :calendar do
    id { SecureRandom.uuid }
    label { "primary" }
    calendar_id { "primary" }
    credentials_file { "credentials.json" }
  end
end