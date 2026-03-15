# Task 008 — Integrations API

## Goal

Implement the Rails API controllers, background job, service object, and
serializers that expose Memory, Calendar, WhatsApp Group, and WhatsApp Setting
resources. Also fully implement `Memories::AgentService`, which is called by the
pipeline executor (Task 004) to read from and write to memory stores.

---

## Prerequisites

- Task 002 complete: all nine AR models present and migrated.
- Task 003 complete: `WhatsAppClient` HTTP client exists at
  `rails/app/services/whatsapp_client.rb`.
- Task 004 complete: pipeline executor calls `Memories::AgentService` — this
  task provides its full implementation.

---

## Implementation steps

### 1. Route definitions

Add to `rails/config/routes.rb` inside the `namespace :api do namespace :v1 do`
block:

```ruby
namespace :integrations do
  resources :memories, param: :label, only: [:index, :show, :create, :destroy] do
    get  :entries, on: :member   # GET /api/v1/integrations/memories/:label/entries
  end

  resources :calendars, only: [:index, :create, :destroy]

  resources :whatsapp_groups, only: [:index, :update] do
    collection do
      post :sync
    end
  end
end
```

---

### 2. Memories controller

**`rails/app/controllers/api/v1/integrations/memories_controller.rb`**

```ruby
module Api::V1::Integrations
  class MemoriesController < ApplicationController
    before_action :set_memory, only: [:show, :destroy, :entries]

    # GET /api/v1/integrations/memories
    def index
      @memories = Memory.all.order(:label)
      render json: MemorySerializer.render(@memories)
    end

    # GET /api/v1/integrations/memories/:label
    def show
      render json: MemorySerializer.render(@memory)
    end

    # POST /api/v1/integrations/memories
    def create
      @memory = Memory.new(memory_params)
      if @memory.save
        render json: MemorySerializer.render(@memory), status: :created
      else
        render json: { errors: @memory.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # DELETE /api/v1/integrations/memories/:label
    def destroy
      @memory.destroy!
      head :no_content
    end

    # GET /api/v1/integrations/memories/:label/entries
    def entries
      n = (params[:n] || 20).to_i.clamp(1, 500)
      entries = @memory.memory_entries.order(created_at: :desc).limit(n)
      render json: MemoryEntrySerializer.render(entries)
    end

    private

    def set_memory
      @memory = Memory.find_by!(label: params[:label])
    end

    def memory_params
      params.require(:memory).permit(:label, :max_memories, :ttl_hours, :max_value_size)
    end
  end
end
```

---

### 3. Calendars controller

**`rails/app/controllers/api/v1/integrations/calendars_controller.rb`**

```ruby
module Api::V1::Integrations
  class CalendarsController < ApplicationController
    before_action :set_calendar, only: [:destroy]

    # GET /api/v1/integrations/calendars
    def index
      render json: CalendarSerializer.render(Calendar.all.order(:label))
    end

    # POST /api/v1/integrations/calendars
    def create
      @calendar = Calendar.new(calendar_params)
      if @calendar.save
        render json: CalendarSerializer.render(@calendar), status: :created
      else
        render json: { errors: @calendar.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # DELETE /api/v1/integrations/calendars/:id
    def destroy
      @calendar.destroy!
      head :no_content
    end

    private

    def set_calendar
      @calendar = Calendar.find(params[:id])
    end

    def calendar_params
      params.require(:calendar).permit(:label, :calendar_id, :credentials_file)
    end
  end
end
```

---

### 4. WhatsApp groups controller

**`rails/app/controllers/api/v1/integrations/whatsapp_groups_controller.rb`**

```ruby
module Api::V1::Integrations
  class WhatsappGroupsController < ApplicationController
    before_action :set_group, only: [:update]

    # GET /api/v1/integrations/whatsapp_groups
    def index
      render json: WhatsAppGroupSerializer.render(WhatsAppGroup.all.order(:name))
    end

    # PUT /api/v1/integrations/whatsapp_groups/:jid
    # Updates the human-readable label on a synced group.
    def update
      if @group.update(label: params.dig(:whatsapp_group, :label).to_s.strip)
        render json: WhatsAppGroupSerializer.render(@group)
      else
        render json: { errors: @group.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # POST /api/v1/integrations/whatsapp_groups/sync
    # Enqueues WhatsAppSyncJob and returns 202.
    def sync
      WhatsAppSyncJob.perform_later
      render json: { ok: true }, status: :accepted
    end

    private

    def set_group
      @group = WhatsAppGroup.find(params[:id])
    end
  end
end
```

---

### 5. WhatsAppSyncJob

**`rails/app/jobs/whats_app_sync_job.rb`**

```ruby
class WhatsAppSyncJob < ApplicationJob
  queue_as :default

  # Calls the WhatsApp service to fetch the current group list, then upserts
  # each group into the whats_app_groups table by JID (primary key).
  def perform
    groups = WhatsAppClient.new.groups   # returns Array<{ jid:, name: }>

    groups.each do |group|
      WhatsAppGroup.find_or_initialize_by(jid: group[:jid]).tap do |g|
        g.name = group[:name]
        g.save!
      end
    end
  end
end
```

`WhatsAppClient#groups` must return an array of hashes with at minimum `:jid`
and `:name` keys. Raise on non-2xx from the WhatsApp service so Sidekiq will
retry automatically.

---

### 6. Memories::AgentService

**`rails/app/services/memories/agent_service.rb`**

This class is the sole interface between the pipeline executor and the Memory
models. It must be fully self-contained — no knowledge of HTTP; all persistence
is through ActiveRecord.

```ruby
module Memories
  class AgentService
    # store(label, value) — appends a new MemoryEntry for the given Memory label.
    #   Enforces max_memories: deletes the oldest entries when over the limit.
    #   Enforces max_value_size: truncates value silently if too long.
    #   Raises ActiveRecord::RecordNotFound if label does not exist.
    def store(label, value)
      memory = Memory.find_by!(label: label)

      truncated = value.to_s.first(memory.max_value_size)

      MemoryEntry.transaction do
        memory.memory_entries.create!(value: truncated)
        enforce_max_memories(memory)
      end
    end

    # read(label, n) — returns the last n non-expired MemoryEntry values as an
    #   Array<String>, newest first.
    #   Raises ActiveRecord::RecordNotFound if label does not exist.
    def read(label, n = 10)
      memory = Memory.find_by!(label: label)
      cutoff = memory.ttl_hours.hours.ago

      memory
        .memory_entries
        .where("created_at > ?", cutoff)
        .order(created_at: :desc)
        .limit(n)
        .pluck(:value)
    end

    private

    # Deletes oldest entries so the total count stays within max_memories.
    def enforce_max_memories(memory)
      total = memory.memory_entries.count
      excess = total - memory.max_memories
      return unless excess > 0

      oldest_ids = memory
        .memory_entries
        .order(created_at: :asc)
        .limit(excess)
        .pluck(:id)

      MemoryEntry.where(id: oldest_ids).delete_all
    end
  end
end
```

---

### 7. Serializers

Use Blueprinter (or jsonapi-serializer — match the gem chosen in Task 001).

**`rails/app/serializers/memory_serializer.rb`**

```ruby
class MemorySerializer < Blueprinter::Base
  identifier :id
  fields :label, :max_memories, :ttl_hours, :max_value_size, :created_at, :updated_at
end
```

**`rails/app/serializers/memory_entry_serializer.rb`**

```ruby
class MemoryEntrySerializer < Blueprinter::Base
  identifier :id
  fields :memory_id, :value, :created_at
end
```

**`rails/app/serializers/calendar_serializer.rb`**

```ruby
class CalendarSerializer < Blueprinter::Base
  identifier :id
  fields :label, :calendar_id, :credentials_file, :created_at, :updated_at
end
```

**`rails/app/serializers/whats_app_group_serializer.rb`**

```ruby
class WhatsAppGroupSerializer < Blueprinter::Base
  identifier :jid
  fields :name, :label
end
```

---

### 8. Request specs

All specs live under `rails/spec/requests/api/v1/integrations/`.

#### memories_spec.rb — key cases

- `GET /api/v1/integrations/memories` returns array of memories
- `POST /api/v1/integrations/memories` with valid params creates Memory, returns 201
- `POST /api/v1/integrations/memories` with duplicate label returns 422
- `DELETE /api/v1/integrations/memories/:label` destroys Memory and entries, returns 204
- `GET /api/v1/integrations/memories/:label/entries` returns last N entries, respects `n` param

#### calendars_spec.rb — key cases

- `GET /api/v1/integrations/calendars` returns array
- `POST /api/v1/integrations/calendars` with valid params returns 201
- `POST /api/v1/integrations/calendars` missing required field returns 422
- `DELETE /api/v1/integrations/calendars/:id` returns 204

#### whatsapp_groups_spec.rb — key cases

- `GET /api/v1/integrations/whatsapp_groups` returns array
- `PUT /api/v1/integrations/whatsapp_groups/:jid` updates label
- `POST /api/v1/integrations/whatsapp_groups/sync` enqueues `WhatsAppSyncJob`, returns 202

#### memories/agent_service_spec.rb (unit spec)

- `store` creates a MemoryEntry, truncates at max_value_size
- `store` deletes oldest entry when max_memories is exceeded
- `read` excludes entries older than ttl_hours
- `read` returns newest-first order

Use `WebMock` to stub `WhatsAppClient` HTTP calls in the sync job spec. Use
`have_enqueued_job` matcher for the sync endpoint spec.

---

## File / class list

| Path | Description |
|---|---|
| `rails/app/controllers/api/v1/integrations/memories_controller.rb` | CRUD + entries for Memory configs |
| `rails/app/controllers/api/v1/integrations/calendars_controller.rb` | CRUD for Calendar configs |
| `rails/app/controllers/api/v1/integrations/whatsapp_groups_controller.rb` | Group list, label update, sync trigger |
| `rails/app/jobs/whats_app_sync_job.rb` | Fetches groups from WA service and upserts WhatsAppGroup rows |
| `rails/app/services/memories/agent_service.rb` | Memory read/write with TTL + max enforcement |
| `rails/app/serializers/memory_serializer.rb` | Blueprinter serializer for Memory |
| `rails/app/serializers/memory_entry_serializer.rb` | Blueprinter serializer for MemoryEntry |
| `rails/app/serializers/calendar_serializer.rb` | Blueprinter serializer for Calendar |
| `rails/app/serializers/whats_app_group_serializer.rb` | Blueprinter serializer for WhatsAppGroup |
| `rails/spec/requests/api/v1/integrations/memories_spec.rb` | Request specs for Memories endpoints |
| `rails/spec/requests/api/v1/integrations/calendars_spec.rb` | Request specs for Calendars endpoints |
| `rails/spec/requests/api/v1/integrations/whatsapp_groups_spec.rb` | Request specs for WhatsApp groups |
| `rails/spec/services/memories/agent_service_spec.rb` | Unit specs for AgentService |
| `rails/spec/jobs/whats_app_sync_job_spec.rb` | Job spec with stubbed WhatsAppClient |

---

## Acceptance criteria

- [ ] `GET /api/v1/integrations/memories` returns JSON array with all Memory records
- [ ] `POST /api/v1/integrations/memories` with `{ label: "notes", max_memories: 10, ttl_hours: 24, max_value_size: 500 }` creates a record and returns 201
- [ ] `GET /api/v1/integrations/memories/notes/entries` returns the last entries for the `notes` memory
- [ ] `DELETE /api/v1/integrations/memories/notes` removes the Memory and all its MemoryEntries
- [ ] `POST /api/v1/integrations/whatsapp_groups/sync` returns 202 and enqueues `WhatsAppSyncJob`
- [ ] Running `WhatsAppSyncJob` with a stubbed WA service response upserts WhatsAppGroup rows
- [ ] `PUT /api/v1/integrations/whatsapp_groups/:jid` updates the group's label
- [ ] `Memories::AgentService#store` enforces `max_memories`: calling store 11 times on a max_memories=10 config leaves exactly 10 entries
- [ ] `Memories::AgentService#store` truncates values longer than `max_value_size`
- [ ] `Memories::AgentService#read` skips entries older than `ttl_hours`
- [ ] `bundle exec rspec spec/requests/api/v1/integrations spec/services/memories spec/jobs/whats_app_sync_job_spec.rb` passes with zero failures
