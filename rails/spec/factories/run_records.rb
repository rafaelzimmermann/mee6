FactoryBot.define do
  factory :run_record do
    pipeline_id { SecureRandom.uuid }
    pipeline_name { Faker::Lorem.words(number: 3).join(" ").titleize }
    timestamp { Time.current }
    status { "success" }
    summary { Faker::Lorem.sentence }

    trait :success do
      status { "success" }
    end

    trait :error do
      status { "error" }
    end

    trait :running do
      status { "running" }
    end
  end
end