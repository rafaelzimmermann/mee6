FactoryBot.define do
  factory :trigger do
    id { SecureRandom.uuid }
    pipeline
    trigger_type { :cron }
    cron_expr { "0 8 * * *" }
    config { {} }
    enabled { true }

    trait :cron do
      trigger_type { :cron }
      cron_expr { "0 8 * * *" }
    end

    trait :whatsapp do
      trigger_type { :whatsapp }
      config { { phone: "+15550193456" } }
    end

    trait :wa_group do
      trigger_type { :wa_group }
      config { { group_jid: "1234567890@g.us" } }
    end

    trait :disabled do
      enabled { false }
    end
  end
end