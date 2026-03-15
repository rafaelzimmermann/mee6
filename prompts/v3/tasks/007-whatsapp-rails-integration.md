# Task 007 — WhatsApp Rails Integration

## Goal

Wire the Rails application into the WhatsApp service lifecycle: receive inbound
message webhooks and dispatch matching pipelines; register monitored
phones/groups with the WhatsApp service on boot and whenever triggers change;
proxy WhatsApp status/control calls through the API; and expose WhatsApp
settings management.

---

## Prerequisites

- Task 002 complete: `Trigger`, `WhatsAppSetting`, `WhatsAppGroup` models
  present.
- Task 003 complete: `TriggersController` with toggle and run_now.
- Task 004 complete: `PipelineJob` and `Integrations::WhatsAppClient` present.

---

## Implementation steps

### 1. `Webhooks::WhatsAppController`

`rails/app/controllers/webhooks/whats_app_controller.rb`

Receives inbound message callbacks from the WhatsApp service. Validates the
shared secret before processing anything.

```ruby
module Webhooks
  class WhatsAppController < ApplicationController
    before_action :verify_secret

    # POST /webhooks/whatsapp
    def receive
      Triggers::DispatchService.new.call(
        type:     payload[:type],
        sender:   payload[:sender],       # present for DMs
        chat_jid: payload[:chat_jid],     # present for groups
        text:     payload[:text].to_s
      )
      head :ok
    end

    private

    def verify_secret
      provided = request.headers["X-Webhook-Secret"]
      expected = ENV.fetch("WEBHOOK_SECRET", "changeme")
      unless ActiveSupport::SecurityUtils.secure_compare(provided.to_s, expected)
        render json: { error: "Unauthorized" }, status: :unauthorized
      end
    end

    def payload
      @payload ||= params.permit(:type, :sender, :chat_jid, :text).to_h.with_indifferent_access
    end
  end
end
```

Route:

```ruby
# config/routes.rb
post "/webhooks/whatsapp", to: "webhooks/whats_app#receive"
```

---

### 2. `Triggers::DispatchService`

`rails/app/services/triggers/dispatch_service.rb`

Given the normalised fields from an inbound webhook, finds all matching
enabled triggers and enqueues a `PipelineJob` for each with the message text
as `initial_input`.

```ruby
module Triggers
  class DispatchService
    # type:     "dm" | "group"
    # sender:   phone string (present for DMs, e.g. "15550001234@s.whatsapp.net")
    # chat_jid: group JID string (present for groups)
    # text:     inbound message text
    def call(type:, sender: nil, chat_jid: nil, text:)
      triggers = find_matching_triggers(type:, sender:, chat_jid:)
      triggers.each do |trigger|
        PipelineJob.perform_later(trigger.pipeline_id, text)
      end
    end

    private

    def find_matching_triggers(type:, sender:, chat_jid:)
      case type.to_s
      when "dm"
        phone = normalise_phone(sender.to_s)
        Trigger.enabled.whatsapp.select do |t|
          t.config["phone"].present? &&
            normalise_phone(t.config["phone"]) == phone
        end
      when "group"
        Trigger.enabled.wa_group.select do |t|
          t.config["group_jid"] == chat_jid
        end
      else
        []
      end
    end

    # Strip non-digits and leading country-code prefixes for flexible matching.
    # "+1 555 000 1234", "15550001234", "5550001234@s.whatsapp.net" → "15550001234"
    def normalise_phone(raw)
      digits = raw.gsub(/\D/, "")
      # Strip the @... suffix if present before gsub (already done above)
      digits
    end
  end
end
```

---

### 3. WhatsApp registration initializer

`rails/config/initializers/whatsapp_registration.rb`

On boot, reads all enabled WA/WA_GROUP triggers and posts their phones and
group JIDs to the WhatsApp service `/monitor` endpoint. Any error is logged
but does not prevent Rails from booting.

```ruby
module WhatsAppRegistration
  def self.register_all
    triggers = Trigger.enabled.wa_types.to_a
    return if triggers.empty?

    phones     = triggers.select(&:whatsapp?).filter_map { |t| t.config["phone"] }.uniq
    group_jids = triggers.select(&:wa_group?).filter_map { |t| t.config["group_jid"] }.uniq

    callback_url = "#{ENV.fetch("RAILS_BASE_URL", "http://localhost:3000")}/webhooks/whatsapp"

    Integrations::WhatsAppClient.new.monitor(
      callback_url:,
      phones:,
      group_jids:
    )
  rescue => e
    Rails.logger.error("[WhatsAppRegistration] Failed to register monitors: #{e.message}")
  end
end

if !Rails.env.test?
  Rails.application.config.after_initialize do
    WhatsAppRegistration.register_all
  end
end
```

Add `RAILS_BASE_URL` to `.env.example`.

---

### 4. Re-registration hook in TriggersController

After any WA/WA_GROUP trigger is created, updated, deleted, or toggled, call
`WhatsAppRegistration.register_all` to push the updated phone/group list to
the WhatsApp service.

In `rails/app/controllers/api/v1/triggers_controller.rb`, add to `create`,
`update`, `destroy`, and `toggle`:

```ruby
after_action :sync_whatsapp_registration, only: [:create, :update, :destroy, :toggle]

private

def sync_whatsapp_registration
  # Only re-register if the trigger was a WA type or just became one
  WhatsAppRegistration.register_all if whatsapp_trigger_affected?
end

def whatsapp_trigger_affected?
  @trigger&.whatsapp? || @trigger&.wa_group? ||
    %w[whatsapp wa_group].include?(params.dig(:trigger, :trigger_type))
end
```

---

### 5. `api/v1/integrations/whatsapp_controller.rb`

`rails/app/controllers/api/v1/integrations/whatsapp_controller.rb`

Proxy controller — forwards status/control requests to the WhatsApp service
and relays the response. Settings (phone number) are stored locally in Rails.

```ruby
module Api
  module V1
    module Integrations
      class WhatsappController < BaseController
        # GET /api/v1/integrations/whatsapp/status
        def status
          data = whatsapp_client.status
          render json: data
        rescue Integrations::WhatsAppClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        # POST /api/v1/integrations/whatsapp/connect
        def connect
          whatsapp_client.connect
          head :accepted
        rescue Integrations::WhatsAppClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        # POST /api/v1/integrations/whatsapp/disconnect
        def disconnect
          whatsapp_client.disconnect
          head :ok
        rescue Integrations::WhatsAppClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        # GET /api/v1/integrations/whatsapp/groups
        # Fetches live groups and upserts WhatsAppGroup records in Rails DB.
        def groups
          data = whatsapp_client.groups
          upsert_groups(data)
          render json: data
        rescue Integrations::WhatsAppClient::ServiceError => e
          render json: { error: e.message }, status: :bad_gateway
        end

        # GET /api/v1/integrations/whatsapp/settings
        def settings
          render json: { phone_number: WhatsAppSetting.current.phone_number }
        end

        # PUT /api/v1/integrations/whatsapp/settings
        def update_settings
          WhatsAppSetting.current.update!(settings_params)
          render json: { phone_number: WhatsAppSetting.current.phone_number }
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        private

        def whatsapp_client
          @whatsapp_client ||= Integrations::WhatsAppClient.new
        end

        def settings_params
          params.require(:whatsapp_setting).permit(:phone_number)
        end

        def upsert_groups(groups_data)
          groups_data.each do |g|
            WhatsAppGroup.find_or_initialize_by(jid: g["jid"]).tap do |record|
              record.name = g["name"]
              record.save!
            end
          end
        end
      end
    end
  end
end
```

Routes:

```ruby
namespace :api do
  namespace :v1 do
    namespace :integrations do
      scope :whatsapp do
        get    "status",     to: "whatsapp#status"
        post   "connect",    to: "whatsapp#connect"
        post   "disconnect", to: "whatsapp#disconnect"
        get    "groups",     to: "whatsapp#groups"
        get    "settings",   to: "whatsapp#settings"
        put    "settings",   to: "whatsapp#update_settings"
      end
    end
  end
end
```

---

### 6. Pipeline step routing (ExecutorService — already done in Task 004)

`Pipelines::ExecutorService` already routes `whatsapp_agent` and
`whatsapp_group_send` steps through `Integrations::WhatsAppClient#send`. No
changes needed here.

---

### 7. Request specs

#### `spec/requests/webhooks/whats_app_spec.rb`

Key cases:

- `POST /webhooks/whatsapp` with correct secret and DM payload → 200, one
  `PipelineJob` enqueued per matching trigger
- `POST /webhooks/whatsapp` with correct secret and group payload → 200, job
  enqueued for matching group trigger
- `POST /webhooks/whatsapp` with wrong/missing secret → 401, no job enqueued
- `POST /webhooks/whatsapp` with a phone that matches no enabled trigger → 200,
  no job enqueued

Setup: create enabled WA triggers with known phones/group_jids using FactoryBot.

#### `spec/services/triggers/dispatch_service_spec.rb`

Key cases:

- DM type with matching phone → one job enqueued with correct `initial_input`
- DM type with non-matching phone → no job enqueued
- Group type with matching JID → job enqueued
- Group type with non-matching JID → no job enqueued
- Disabled trigger → not matched even if phone matches
- Multiple matching triggers → one job per trigger

#### `spec/requests/api/v1/integrations/whatsapp_spec.rb`

Use WebMock to stub calls to the WhatsApp service URL.

Key cases:

- `GET /api/v1/integrations/whatsapp/status` → proxies response
- `POST /api/v1/integrations/whatsapp/connect` → 202
- `GET /api/v1/integrations/whatsapp/groups` → 200, upserts `WhatsAppGroup`
  records
- `GET /api/v1/integrations/whatsapp/settings` → returns `phone_number`
- `PUT /api/v1/integrations/whatsapp/settings` → updates `phone_number`
- WhatsApp service returns non-200 → 502

---

## File / class list

| Path | Description |
|---|---|
| `rails/app/controllers/webhooks/whats_app_controller.rb` | Receives inbound WA webhooks; validates secret; calls DispatchService |
| `rails/app/services/triggers/dispatch_service.rb` | Finds matching enabled triggers and enqueues PipelineJob per trigger |
| `rails/config/initializers/whatsapp_registration.rb` | `WhatsAppRegistration.register_all`; called on boot and after trigger mutations |
| `rails/app/controllers/api/v1/integrations/whatsapp_controller.rb` | Proxy: status, connect, disconnect, groups; local: settings CRUD |
| `rails/config/routes.rb` | Webhook route + integrations/whatsapp routes |
| `rails/spec/requests/webhooks/whats_app_spec.rb` | Webhook controller request specs |
| `rails/spec/services/triggers/dispatch_service_spec.rb` | DispatchService unit specs |
| `rails/spec/requests/api/v1/integrations/whatsapp_spec.rb` | Integrations controller request specs |

---

## Acceptance criteria

- [ ] `POST /webhooks/whatsapp` with valid secret and a DM payload matching an
      enabled trigger enqueues exactly one `PipelineJob` with `initial_input`
      equal to the message text
- [ ] `POST /webhooks/whatsapp` with an invalid secret returns 401 and enqueues
      no jobs
- [ ] `POST /webhooks/whatsapp` for a phone with no matching enabled trigger
      returns 200 and enqueues no jobs
- [ ] On Rails boot (`after_initialize`), `WhatsAppRegistration.register_all`
      calls `POST /monitor` on the WhatsApp service with all enabled WA/WA_GROUP
      phones and group JIDs
- [ ] Creating a new WA trigger via `POST /api/v1/triggers` triggers a
      re-registration call to the WhatsApp service
- [ ] Disabling a WA trigger via toggle triggers a re-registration (the phone
      is no longer sent in the monitor call)
- [ ] `GET /api/v1/integrations/whatsapp/groups` upserts `WhatsAppGroup` records
      from the WhatsApp service response
- [ ] `bundle exec rspec spec/requests/webhooks spec/services/triggers/dispatch_service_spec.rb spec/requests/api/v1/integrations` passes with zero failures
