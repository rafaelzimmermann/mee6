FactoryBot.define do
  factory :memory_entry do
    memory
    value { Faker::Lorem.paragraph }
  end
end