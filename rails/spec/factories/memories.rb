FactoryBot.define do
  factory :memory do
    id { SecureRandom.uuid }
    label { "general" }
    max_memories { 100 }
    ttl_hours { 24 }
    max_value_size { 1000 }
  end
end