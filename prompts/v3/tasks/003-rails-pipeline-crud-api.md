# Task 003 — Rails Pipeline CRUD API

## Goal

Expose a JSON API under `/api/v1/` for full pipeline management (pipelines with
embedded steps), triggers, and run record history. Steps are not a separate
resource — they are created, replaced, and destroyed as part of their parent
pipeline payload. All endpoints are covered by request specs.

---

## Prerequisites

- Task 002 complete: all models and migrations in place.
- Task 015 complete: `ApplicationController` has `before_action :require_auth`.
  All request specs must authenticate before hitting any endpoint.

---

## Implementation steps

### 1. Spec auth helper

`ApplicationController` protects every action with `require_auth`. Request specs
must call `sign_in_admin` before making any API request.

Create `rails/spec/support/auth_helpers.rb`:

```ruby
module AuthHelpers
  def sign_in_admin
    unless AdminCredential.configured?
      AdminCredential.create!(
        password:              "password123",
        password_confirmation: "password123"
      )
    end
    post "/api/v1/auth/login", params: { password: "password123" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
```

Uncomment (or add) the support autoload line in `rails/spec/rails_helper.rb`:

```ruby
Rails.root.glob("spec/support/**/*.rb").sort_by(&:to_s).each { |f| require f }
```

Every request spec `describe` block must include:

```ruby
before { sign_in_admin }
```

---

### 2. Stub job (full implementation in Task 004)

`run_now` calls `PipelineJob` which doesn't exist until Task 004. Create a
minimal stub now so tests don't raise `NameError`:

`rails/app/jobs/pipeline_job.rb`

```ruby
class PipelineJob < ApplicationJob
  queue_as :default

  def perform(pipeline_id)
    # Implemented in Task 004
  end
end
```

---

### 3. Base controller

`rails/app/controllers/api/v1/base_controller.rb`

```ruby
module Api
  module V1
    class BaseController < ApplicationController
      rescue_from ActiveRecord::RecordNotFound,       with: :not_found
      rescue_from ActiveRecord::RecordInvalid,        with: :unprocessable
      rescue_from ActionController::ParameterMissing, with: :bad_request

      private

      def not_found(e)     = render json: { error: e.message }, status: :not_found
      def unprocessable(e) = render json: { error: e.record.errors.full_messages }, status: :unprocessable_entity
      def bad_request(e)   = render json: { error: e.message }, status: :bad_request
    end
  end
end
```

---

### 4. Serializers (Blueprinter)

#### `PipelineBlueprint` — `rails/app/serializers/pipeline_blueprint.rb`

```ruby
class PipelineBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :created_at, :updated_at

  view :with_steps do
    association :pipeline_steps, blueprint: PipelineStepBlueprint, name: :steps
  end
end
```

#### `PipelineStepBlueprint` — `rails/app/serializers/pipeline_step_blueprint.rb`

```ruby
class PipelineStepBlueprint < Blueprinter::Base
  identifier :id
  fields :step_index, :agent_type, :config
end
```

#### `TriggerBlueprint` — `rails/app/serializers/trigger_blueprint.rb`

```ruby
class TriggerBlueprint < Blueprinter::Base
  identifier :id
  fields :pipeline_id, :trigger_type, :cron_expr, :config, :enabled,
         :created_at, :updated_at
end
```

#### `RunRecordBlueprint` — `rails/app/serializers/run_record_blueprint.rb`

```ruby
class RunRecordBlueprint < Blueprinter::Base
  identifier :id
  fields :pipeline_id, :pipeline_name, :timestamp, :status, :summary,
         :created_at
end
```

---

### 5. PipelinesController

`rails/app/controllers/api/v1/pipelines_controller.rb`

Actions: `index`, `show`, `create`, `update`, `destroy`.

**`index`** — returns all pipelines without steps (fast list).

```ruby
def index
  render json: PipelineBlueprint.render(Pipeline.ordered)
end
```

**`show`** — returns pipeline with steps embedded.

```ruby
def show
  render json: PipelineBlueprint.render(pipeline, view: :with_steps)
end
```

**`create`** — accepts `{ pipeline: { id, name, steps: [...] } }`. Steps and
pipeline are saved atomically. If `id` is omitted the model assigns a UUID.

```ruby
def create
  pipeline = Pipeline.new(pipeline_params_without_steps)
  ActiveRecord::Base.transaction do
    replace_steps(pipeline, steps_params)
    pipeline.save!
  end
  render json: PipelineBlueprint.render(pipeline, view: :with_steps),
         status: :created
end
```

**`update`** — accepts the same shape as create. If `steps` is present it
**replaces all existing steps atomically** (delete-all then insert-new inside
a transaction). If `steps` key is absent, steps are untouched.

```ruby
def update
  ActiveRecord::Base.transaction do
    pipeline.assign_attributes(pipeline_params_without_steps)
    replace_steps(pipeline, steps_params) if params[:pipeline].key?(:steps)
    pipeline.save!
  end
  render json: PipelineBlueprint.render(pipeline, view: :with_steps)
end
```

**`destroy`**

```ruby
def destroy
  pipeline.destroy!
  head :no_content
end
```

**Private helpers**

```ruby
private

def pipeline
  @pipeline ||= Pipeline.find(params[:id])
end

def pipeline_params_without_steps
  params.require(:pipeline).permit(:id, :name)
end

def steps_params
  params[:pipeline][:steps]&.map do |s|
    s.permit(:step_index, :agent_type, config: {})
  end || []
end

def replace_steps(pipeline, steps_attrs)
  pipeline.pipeline_steps.destroy_all
  steps_attrs.each_with_index do |attrs, idx|
    pipeline.pipeline_steps.build(attrs.merge(step_index: attrs[:step_index] || idx))
  end
end
```

> **Note on `config: {}`**: `permit(config: {})` allows any flat key-value
> pairs but silently drops array values within config. This is acceptable for
> current agent types (all configs are flat). If a future agent type stores
> arrays in config, the permit call will need updating.

---

### 6. TriggersController

`rails/app/controllers/api/v1/triggers_controller.rb`

Actions: `index`, `show`, `create`, `update`, `destroy`, `run_now`, `toggle`.

**`index`** — optional `?pipeline_id=` filter.

```ruby
def index
  triggers = params[:pipeline_id] ? Trigger.where(pipeline_id: params[:pipeline_id])
                                   : Trigger.all
  render json: TriggerBlueprint.render(triggers)
end
```

**`create`** — permitted params: `pipeline_id`, `trigger_type`, `cron_expr`,
`config`, `enabled`.

**`update`** — same permitted params.

**`run_now`** — enqueues `PipelineJob` immediately regardless of schedule.

```ruby
def run_now
  PipelineJob.perform_later(trigger.pipeline_id)
  render json: { ok: true }
end
```

**`toggle`** — flips `enabled`. Task 005 will add scheduler sync here.

```ruby
def toggle
  trigger.update!(enabled: !trigger.enabled)
  # Triggers::SchedulerService.sync_trigger(trigger)  ← wired in Task 005
  render json: TriggerBlueprint.render(trigger)
end
```

**Private helpers**

```ruby
def trigger
  @trigger ||= Trigger.find(params[:id])
end

def trigger_params
  params.require(:trigger).permit(:pipeline_id, :trigger_type, :cron_expr,
                                  :enabled, config: {})
end
```

---

### 7. RunRecordsController

`rails/app/controllers/api/v1/run_records_controller.rb`

Actions: `index` only.

```ruby
def index
  records = RunRecord.recent
  records = records.for_pipeline(params[:pipeline_id]) if params[:pipeline_id]
  render json: RunRecordBlueprint.render(records)
end
```

---

### 8. Routes

**Add** the following inside the existing `namespace :v1` block in
`rails/config/routes.rb`. Do not replace the auth routes already there.

```ruby
resources :pipelines
resources :triggers do
  member do
    post  :run_now
    patch :toggle
  end
end
resources :run_records, only: [:index]
```

---

### 9. Request specs

All specs live under `rails/spec/requests/api/v1/`. Every describe block must
call `before { sign_in_admin }` (see section 1).

#### `pipelines_spec.rb` — key cases

- `GET /api/v1/pipelines` → 200, returns array, no `steps` key in items
- `GET /api/v1/pipelines/:id` → 200, `steps` key present
- `GET /api/v1/pipelines/:nonexistent` → 404
- `POST /api/v1/pipelines` with valid params → 201, pipeline + steps in body
- `POST /api/v1/pipelines` missing name → 422 with error array
- `PUT /api/v1/pipelines/:id` with new steps array → 200, old steps gone, new
  steps present; if one step is invalid the entire update rolls back (old steps
  survive)
- `PUT /api/v1/pipelines/:id` without `steps` key → steps untouched
- `DELETE /api/v1/pipelines/:id` → 204, pipeline gone, steps cascade-deleted

#### `triggers_spec.rb` — key cases

- `GET /api/v1/triggers` → 200
- `GET /api/v1/triggers?pipeline_id=X` → returns only triggers for that pipeline
- `POST /api/v1/triggers` cron type without `cron_expr` → 422
- `POST /api/v1/triggers` valid cron → 201
- `PATCH /api/v1/triggers/:id/toggle` → flips `enabled`
- `POST /api/v1/triggers/:id/run_now` → 200, enqueues `PipelineJob`
  (assert with `have_enqueued_job(PipelineJob)`)
- `DELETE /api/v1/triggers/:id` → 204

#### `run_records_spec.rb` — key cases

- `GET /api/v1/run_records` → 200, returns all records most-recent first
- `GET /api/v1/run_records?pipeline_id=X` → returns only matching records

---

## File / class list

| Path | Description |
|---|---|
| `rails/spec/support/auth_helpers.rb` | `sign_in_admin` helper included in all request specs |
| `rails/app/jobs/pipeline_job.rb` | Stub job (full impl in Task 004) |
| `rails/app/controllers/api/v1/base_controller.rb` | Shared error handling for all v1 controllers |
| `rails/app/controllers/api/v1/pipelines_controller.rb` | Pipeline CRUD; atomic step replacement |
| `rails/app/controllers/api/v1/triggers_controller.rb` | Trigger CRUD + run_now + toggle |
| `rails/app/controllers/api/v1/run_records_controller.rb` | Run record list (read-only) |
| `rails/app/serializers/pipeline_blueprint.rb` | Pipeline serializer (default + with_steps view) |
| `rails/app/serializers/pipeline_step_blueprint.rb` | PipelineStep serializer |
| `rails/app/serializers/trigger_blueprint.rb` | Trigger serializer |
| `rails/app/serializers/run_record_blueprint.rb` | RunRecord serializer |
| `rails/config/routes.rb` | Add pipeline/trigger/run_record routes alongside existing auth routes |
| `rails/spec/requests/api/v1/pipelines_spec.rb` | Pipeline endpoint request specs |
| `rails/spec/requests/api/v1/triggers_spec.rb` | Trigger endpoint request specs |
| `rails/spec/requests/api/v1/run_records_spec.rb` | RunRecord endpoint request specs |

---

## Acceptance criteria

- [ ] `GET /api/v1/pipelines` returns `[]` on a fresh database (after login)
- [ ] `POST /api/v1/pipelines` with `{ pipeline: { name: "Test", steps: [{ step_index: 0, agent_type: "debug_agent", config: { debug: true } }] } }` returns 201 with `steps` in body
- [ ] `PUT /api/v1/pipelines/:id` with a new steps array replaces all previous
      steps; passing an invalid step rolls back the entire update (old steps survive)
- [ ] `POST /api/v1/triggers/:id/run_now` enqueues exactly one `PipelineJob`
- [ ] `PATCH /api/v1/triggers/:id/toggle` flips enabled from true to false and back
- [ ] `GET /api/v1/run_records?pipeline_id=X` returns only records for pipeline X
- [ ] Unauthenticated requests to any endpoint return 401
- [ ] `bundle exec rspec spec/requests` passes with zero failures
