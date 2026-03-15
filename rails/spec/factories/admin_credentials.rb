FactoryBot.define do
  factory :admin_credential do
    password { "password123" }
    
    after(:build) do |credential, evaluator|
      credential.password_confirmation = evaluator.password if evaluator.password.present?
    end
  end
end