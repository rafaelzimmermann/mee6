Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"

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
