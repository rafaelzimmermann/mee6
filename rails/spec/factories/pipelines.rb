FactoryBot.define do
  factory :pipeline do
    id { SecureRandom.uuid }
    name { Faker::Lorem.words(number: 3).join(" ").titleize }
  end
end