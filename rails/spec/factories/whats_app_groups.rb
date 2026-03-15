FactoryBot.define do
  factory :whats_app_group do
    jid { "#{Faker::Number.unique.number(digits: 10)}@g.us" }
    name { Faker::Lorem.words(number: 3).join(" ").titleize }
    label { "" }
  end
end