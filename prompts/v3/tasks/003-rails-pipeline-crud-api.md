# Task 003 — Rails Pipeline CRUD API

## Goal

Expose a JSON API under `/api/v1/` for full pipeline management (pipelines with
embedded steps), triggers, and run record history. Steps are not a separate
resource — they are created, replaced, and destroyed as part of their parent
pipeline payload. All endpoints are covered by request specs.

---

## Prerequisites

- Task 002 complete: all models and migrations in place.

---

## Implementation steps

### 1. Base controller

`rails/app/controllers/api/v1/base_controller.rb`

```ruby
module Api
  module V1
    class BaseController < ApplicationController
      rescue_from ActiveRecord::RecordNotFound,   with: :not_found
      rescue_from ActiveRecord::RecordInvalid,    with: :unprocessable
      rescue_from ActionController::ParameterMissing, with: :bad_request

      private

      def not_found(e)       = render json: { error: e.message }, status: :not_found
      def unprocessable(e)   = render json: { error: e.record.errors.full_messages }, status: :unprocessable_entity
      def bad_request(e)     = render json: { error: e.message }, status: :bad_request
    end
  end
end
```

---

### 2. Serializers (Blueprinter)

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

### 3. PipelinesController

`rails/app/controllers/api/v1/pipelines_controller.rb`

Actions: `index`, `show`, `create`, `update`, `destroy`.

**`index`** — returns all pipelines without steps (fast list).

```ruby
def index
  pipelines = Pipeline.ordered
  render json: PipelineBlueprint.render(pipelines)
end
```

**`show`** — returns pipeline with steps embedded.

```ruby
def show
  render json: PipelineBlueprint.render(pipeline, view: :with_steps)
end
```

**`create`** — accepts `{ pipeline: { id, name, steps: [...] } }`.
Steps are created inside an `ActiveRecord::Base.transaction`.
If `id` is omitted the model assigns a UUID.

```ruby
def create
  pipeline = Pipeline.new(pipeline_params_without_steps)
  replace_steps(pipeline, steps_params)
  pipeline.save!
  render json: PipelineBlueprint.render(pipeline, view: :with_steps),
         status: :created
end
```

**`update`** — accepts the same shape as create. Steps array, if present,
**replaces all existing steps atomically** (delete all, insert new) inside a
transaction. If `steps` key is absent, steps are untouched.

```ruby
def update
  pipeline.assign_attributes(pipeline_params_without_steps)
  replace_steps(pipeline, steps_params) if params[:pipeline].key?(:steps)
  pipeline.save!
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
  # called inside the save! transaction via after_save or explicit transaction
  pipeline.pipeline_steps.destroy_all
  steps_attrs.each_with_index do |attrs, idx|
    pipeline.pipeline_steps.build(attrs.merge(step_index: attrs[:step_index] || idx))
  end
end
```

The atomic replacement must be wrapped in `ActiveRecord::Base.transaction` to
prevent partial writes. Call `pipeline.save!` inside the transaction block.

---

### 4. TriggersController

`rails/app/controllers/api/v1/triggers_controller.rb`

Actions: `index`, `show`, `create`, `update`, `destroy`, `run_now`, `toggle`.

**Routes**

```ruby
resources :triggers do
  member do
    post :run_now
    patch :toggle
  end
end
```

**`index`** — optional `?pipeline_id=` filter.

```ruby
def index
  triggers = pipeline_id_param ? Trigger.where(pipeline_id: pipeline_id_param)
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

**`toggle`** — flips `enabled` and syncs the scheduler (Task 005 wires this
up; add a no-op hook here now).

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

### 5. RunRecordsController

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

### 6. Routes

`rails/config/routes.rb`

```ruby
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :pipelines
      resources :triggers do
        member do
          post :run_now
          patch :toggle
        end
      end
      resources :run_records, only: [:index]
    end
  end
end
```

---

### 7. Request specs

All specs live under `rails/spec/requests/api/v1/`.

#### `pipelines_spec.rb` — key cases

- `GET /api/v1/pipelines` → 200, returns array, no steps embedded
- `GET /api/v1/pipelines/:id` → 200, `steps` key present
- `GET /api/v1/pipelines/:nonexistent` → 404
- `POST /api/v1/pipelines` with valid params → 201, pipeline + steps created
- `POST /api/v1/pipelines` missing name → 422 with error array
- `PUT /api/v1/pipelines/:id` with new steps array → 200, old steps gone, new
  steps present (atomicity: if one step is invalid, no steps are changed)
- `PUT /api/v1/pipelines/:id` without steps key → steps untouched
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
| `rails/app/controllers/api/v1/base_controller.rb` | Shared error handling for all v1 controllers |
| `rails/app/controllers/api/v1/pipelines_controller.rb` | Pipeline CRUD; atomic step replacement |
| `rails/app/controllers/api/v1/triggers_controller.rb` | Trigger CRUD + run_now + toggle |
| `rails/app/controllers/api/v1/run_records_controller.rb` | Run record list (read-only) |
| `rails/app/serializers/pipeline_blueprint.rb` | Pipeline serializer (default + with_steps view) |
| `rails/app/serializers/pipeline_step_blueprint.rb` | PipelineStep serializer |
| `rails/app/serializers/trigger_blueprint.rb` | Trigger serializer |
| `rails/app/serializers/run_record_blueprint.rb` | RunRecord serializer |
| `rails/config/routes.rb` | API route definitions |
| `rails/spec/requests/api/v1/pipelines_spec.rb` | Pipeline endpoint request specs |
| `rails/spec/requests/api/v1/triggers_spec.rb` | Trigger endpoint request specs |
| `rails/spec/requests/api/v1/run_records_spec.rb` | RunRecord endpoint request specs |

---

## Acceptance criteria

- [ ] `GET /api/v1/pipelines` returns `[]` on a fresh database
- [ ] `POST /api/v1/pipelines` with `{ pipeline: { name: "Test", steps: [{ step_index: 0, agent_type: "debug_agent", config: {} }] } }` returns 201 and a body containing `steps`
- [ ] `PUT /api/v1/pipelines/:id` with a new steps array replaces all previous
      steps; passing an invalid step rolls back the entire update
- [ ] `POST /api/v1/triggers/:id/run_now` enqueues exactly one `PipelineJob`
- [ ] `PATCH /api/v1/triggers/:id/toggle` flips enabled from true to false
      and back
- [ ] `GET /api/v1/run_records?pipeline_id=X` returns only records for pipeline X
- [ ] `bundle exec rspec spec/requests` passes with zero failures
