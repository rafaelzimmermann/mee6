FactoryBot.define do
  factory :pipeline_step do
    pipeline
    step_index { 0 }
    agent_type { "llm_agent" }
    config { { test: true } }

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
      config { { "to" => "+15550193456" } }   # executor reads config["to"]
    end

    trait :whatsapp_group_send do
      agent_type { "whatsapp_group_send" }
      config { { "group_jid" => "1234567890@g.us" } }   # executor reads config["group_jid"]
    end

    trait :memory_agent do
      agent_type { "memory_agent" }
      config { { memory_label: "general" } }
    end

    trait :debug_agent do
      agent_type { "debug_agent" }
      config { { debug: true } }
    end
  end
end