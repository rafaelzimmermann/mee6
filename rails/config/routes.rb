Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"

  require "sidekiq/web"
  require "sidekiq-cron"

  Sidekiq::Web.use(Rack::Auth::Basic) do |user, password|
    ActiveSupport::SecurityUtils.secure_compare(
      ::Digest::SHA256.hexdigest(user),
      ::Digest::SHA256.hexdigest(ENV.fetch("SIDEKIQ_WEB_USER", "admin"))
    ) &
    ActiveSupport::SecurityUtils.secure_compare(
      ::Digest::SHA256.hexdigest(password),
      ::Digest::SHA256.hexdigest(ENV.fetch("SIDEKIQ_WEB_PASSWORD", "changeme"))
    )
  end if Rails.env.production?

  mount Sidekiq::Web => "/sidekiq"

  namespace :api do
    namespace :v1 do
      get    "auth/setup_required", to: "auth#setup_required"
      post   "auth/setup",          to: "auth#setup"
      post   "auth/login",          to: "auth#login"
      delete "auth/logout",         to: "auth#logout"
      get    "auth/me",             to: "auth#me"
      put    "auth/password",       to: "auth#change_password"

      resources :pipelines
      resources :triggers do
        member do
          post  :run_now
          patch :toggle
        end
      end

      resources :run_records, only: [:index]
    end
  end
end
