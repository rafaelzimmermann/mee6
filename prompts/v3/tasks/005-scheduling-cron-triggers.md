# Task 005 — Scheduling and Cron Triggers

## Goal

Keep the sidekiq-cron schedule in sync with the `triggers` table at all times.
Cron triggers registered in the DB are automatically scheduled on boot, updated
when triggers change, and removed when they are deleted or disabled. A
lightweight `CronDispatcherJob` is the only entry point sidekiq-cron ever
calls — it just enqueues `PipelineJob`. The Sidekiq web UI is mounted and
protected.

---

## Prerequisites

- Task 002 complete: `Trigger` model with `trigger_type` enum present.
- Task 004 complete: `PipelineJob` exists and is enqueue-able.

---

## Implementation steps

### 1. `Triggers::SchedulerService`

`rails/app/services/triggers/scheduler_service.rb`

Single class that owns all interaction with sidekiq-cron's `Sidekiq::Cron::Job`
API. All public methods are class methods for convenience; internally they
delegate to the Sidekiq::Cron::Job class.

```ruby
module Triggers
  class SchedulerService
    JOB_CLASS = "CronDispatcherJob"

    # Called once on boot. Reads all enabled cron triggers from the DB and
    # ensures sidekiq-cron has exactly those entries — no more, no less.
    # Any stale cron entries (e.g. from a deleted trigger) are removed.
    def self.sync_all
      db_triggers = Trigger.enabled.cron_type.to_a

      # Build desired set keyed by cron job name
      desired = db_triggers.index_by { |t| cron_job_name(t.id) }

      # Remove stale entries
      Sidekiq::Cron::Job.all.each do |job|
        Sidekiq::Cron::Job.destroy(job.name) unless desired.key?(job.name)
      end

      # Upsert desired entries
      db_triggers.each { |t| upsert(t) }
    end

    # Registers or updates a single cron trigger in sidekiq-cron.
    # Silently ignores non-cron triggers.
    def self.add(trigger)
      return unless trigger.cron?
      return unless trigger.enabled?

      upsert(trigger)
    end

    # Removes a trigger's cron entry. Safe to call for any trigger type.
    def self.remove(trigger_id)
      Sidekiq::Cron::Job.destroy(cron_job_name(trigger_id))
    end

    # Enables or disables a trigger's cron entry based on trigger.enabled.
    # Called after a toggle update.
    def self.sync_trigger(trigger)
      return unless trigger.cron?

      if trigger.enabled?
        upsert(trigger)
      else
        remove(trigger.id)
      end
    end

    private

    def self.cron_job_name(trigger_id)
      "pipeline_trigger_#{trigger_id}"
    end

    def self.upsert(trigger)
      Sidekiq::Cron::Job.create(
        name:  cron_job_name(trigger.id),
        cron:  trigger.cron_expr,
        class: JOB_CLASS,
        args:  [trigger.pipeline_id]
      )
    end
  end
end
```

---

### 2. `CronDispatcherJob`

`rails/app/jobs/cron_dispatcher_job.rb`

Intentionally thin — exists only to be the target of sidekiq-cron entries.
Enqueues `PipelineJob` so the actual pipeline execution runs in a separate
worker with its own retry/timeout settings.

```ruby
class CronDispatcherJob < ApplicationJob
  queue_as :default

  # pipeline_id: string — passed directly from the sidekiq-cron args
  def perform(pipeline_id)
    PipelineJob.perform_later(pipeline_id)
  end
end
```

---

### 3. Boot initializer

`rails/config/initializers/scheduler.rb`

```ruby
# Sync the sidekiq-cron schedule with the DB on every Rails boot.
# Guard against running during migrations or assets:precompile where
# the DB may not be available.
if defined?(Sidekiq) && !Rails.env.test?
  Rails.application.config.after_initialize do
    Triggers::SchedulerService.sync_all
  rescue => e
    Rails.logger.error("[SchedulerService] sync_all failed on boot: #{e.message}")
  end
end
```

In test mode sidekiq-cron is not running, so `sync_all` is skipped. Tests
exercise `SchedulerService` by stubbing `Sidekiq::Cron::Job`.

---

### 4. Wire scheduler into TriggersController

Back in `rails/app/controllers/api/v1/triggers_controller.rb`, add scheduler
calls after each mutating action. (The stubs added in Task 003 are replaced
with the real calls.)

```ruby
def create
  trigger = Trigger.new(trigger_params)
  trigger.save!
  Triggers::SchedulerService.add(trigger)
  render json: TriggerBlueprint.render(trigger), status: :created
end

def update
  trigger.assign_attributes(trigger_params)
  trigger.save!
  Triggers::SchedulerService.sync_trigger(trigger)
  render json: TriggerBlueprint.render(trigger)
end

def destroy
  Triggers::SchedulerService.remove(trigger.id)
  trigger.destroy!
  head :no_content
end

def toggle
  trigger.update!(enabled: !trigger.enabled)
  Triggers::SchedulerService.sync_trigger(trigger)
  render json: TriggerBlueprint.render(trigger)
end
```

The order matters for `destroy`: remove from sidekiq-cron before deleting the
DB record so a restart between the two doesn't leave a dangling cron entry.

---

### 5. Trigger enable/disable endpoint

The `toggle` action added in Task 003 is the enable/disable endpoint. No
additional route is needed. The `enabled` field is also writable through the
standard `update` action.

---

### 6. Sidekiq web UI

`rails/config/routes.rb` — add inside the draw block:

```ruby
require "sidekiq/web"
require "sidekiq-cron"  # mounts the Cron tab

# Protect with HTTP Basic in production; adjust to your auth mechanism.
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
```

Add `SIDEKIQ_WEB_USER` and `SIDEKIQ_WEB_PASSWORD` to `.env.example`.

---

### 7. Specs

#### `spec/services/triggers/scheduler_service_spec.rb`

Stub `Sidekiq::Cron::Job` class methods (`create`, `destroy`, `all`) with
doubles or instance_doubles. Do not hit a real Redis.

Key cases:

**`sync_all`**
- Enabled cron triggers are registered via `Sidekiq::Cron::Job.create`
- Disabled cron triggers are not registered
- Stale cron jobs (present in `Sidekiq::Cron::Job.all` but not in DB) are
  destroyed
- Non-cron triggers are ignored

**`add`**
- Calls `Sidekiq::Cron::Job.create` with correct name, cron, class, and args
- Does nothing for a non-cron trigger
- Does nothing for a disabled trigger

**`remove`**
- Calls `Sidekiq::Cron::Job.destroy` with the correct job name

**`sync_trigger`**
- Enabled cron trigger → calls `upsert` path (create)
- Disabled cron trigger → calls destroy
- Non-cron trigger → does nothing

#### `spec/jobs/cron_dispatcher_job_spec.rb`

Key cases:
- `CronDispatcherJob.perform_now(pipeline_id)` enqueues exactly one
  `PipelineJob` with the given `pipeline_id`
  (assert with `have_enqueued_job(PipelineJob).with(pipeline_id)`)

---

## File / class list

| Path | Description |
|---|---|
| `rails/app/services/triggers/scheduler_service.rb` | sync_all / add / remove / sync_trigger against sidekiq-cron |
| `rails/app/jobs/cron_dispatcher_job.rb` | Thin job called by sidekiq-cron; enqueues PipelineJob |
| `rails/config/initializers/scheduler.rb` | Calls SchedulerService.sync_all on boot |
| `rails/config/routes.rb` | Mounts Sidekiq::Web at /sidekiq |
| `rails/spec/services/triggers/scheduler_service_spec.rb` | SchedulerService unit specs |
| `rails/spec/jobs/cron_dispatcher_job_spec.rb` | CronDispatcherJob spec |

---

## Acceptance criteria

- [ ] On `rails server` boot, every enabled cron trigger in the DB appears in
      the sidekiq-cron schedule (visible at `/sidekiq`)
- [ ] `POST /api/v1/triggers` with a valid cron trigger → immediately present
      in sidekiq-cron
- [ ] `PATCH /api/v1/triggers/:id/toggle` on an enabled cron trigger removes
      it from sidekiq-cron; toggling again re-adds it
- [ ] `DELETE /api/v1/triggers/:id` removes the cron entry before the DB row
      is deleted
- [ ] Updating a cron trigger's `cron_expr` via `PUT` reflects the new
      expression in sidekiq-cron immediately
- [ ] `/sidekiq` is accessible in development without credentials and requires
      Basic Auth in production
- [ ] `bundle exec rspec spec/services/triggers spec/jobs/cron_dispatcher_job_spec.rb`
      passes with zero failures
