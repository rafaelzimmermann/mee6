FactoryBot.define do
  factory :pipeline_step do
    pipeline
    step_index { 0 }
    agent_type { "llm_agent" }
    config { {} }

    trait :llm_agent do
      agent_type { "llm_agent" }
      config { { prompt: "Summarise: {{input}}" } }
    end

    trait :browser_agent do
      agent_type { "browser_agent" }
      config { { url: "https://example.com" } }
    end

    trait :calendar_agent do
      agent_type { "calendar_agent" }
      config { { calendar_id: "primary" } }
    end

    trait :whatsapp_agent do
      agent_type { "whatsapp_agent" }
      config { { phone: "+15550193456" } }
    end

    trait :whatsapp_group_send do
      agent_type { "whatsapp_group_send" }
      config { { group_jid: "1234567890@g.us" } }
    end

    trait :memory_agent do
      agent_type { "memory_agent" }
      config { { memory_label: "general" } }
    end

    trait :debug_agent do
      agent_type { "debug_agent" }
      config { {} }
    end
  end
end