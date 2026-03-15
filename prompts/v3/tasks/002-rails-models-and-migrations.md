# Task 002 — Rails Models and Migrations

## Goal

Define all nine ActiveRecord models with associations, validations, and scopes.
Write Rails migrations that produce a schema matching the v2 database layout as
closely as possible so that data can be copied across without transformation.
Provide a seeds file for local development and full model specs.

---

## Prerequisites

- Task 001 complete: Rails app scaffolded, Gemfile gems installed, database
  connection configured.

---

## Implementation steps

### 1. Migrations

Create one migration per logical group. Run them in the order listed. Column
types must match v2 exactly so a `psql \copy` or `INSERT INTO … SELECT` data
migration can be written later without casting.

#### 1a. `create_pipelines`

```ruby
create_table :pipelines, id: :string, force: :cascade do |t|
  t.string :name, null: false
  t.timestamps
end
```

`id` is a string (UUID assigned by the application, matching v2).

#### 1b. `create_pipeline_steps`

```ruby
create_table :pipeline_steps do |t|
  t.string  :pipeline_id, null: false
  t.integer :step_index,  null: false
  t.string  :agent_type,  null: false
  t.jsonb   :config,      null: false, default: {}
  t.timestamps
end

add_index :pipeline_steps, [:pipeline_id, :step_index], unique: true
add_foreign_key :pipeline_steps, :pipelines
```

#### 1c. `create_triggers`

```ruby
create_table :triggers, id: :string, force: :cascade do |t|
  t.string  :pipeline_id,   null: false
  t.integer :trigger_type,  null: false   # stored as integer via Rails enum
  t.string  :cron_expr
  t.jsonb   :config,        null: false, default: {}
  t.boolean :enabled,       null: false, default: true
  t.timestamps
end

add_foreign_key :triggers, :pipelines
```

#### 1d. `create_run_records`

```ruby
create_table :run_records do |t|
  t.string   :pipeline_id,   null: false
  t.string   :pipeline_name, null: false
  t.datetime :timestamp,     null: false
  t.string   :status,        null: false
  t.text     :summary
  t.timestamps
end

add_index :run_records, [:pipeline_id, :timestamp]
```

`run_records` has no FK on `pipeline_id` — the pipeline may be deleted while
run history is retained.

#### 1e. `create_memories`

```ruby
create_table :memories, id: :string, force: :cascade do |t|
  t.string  :label,          null: false
  t.integer :max_memories,   null: false, default: 100
  t.integer :ttl_hours,      null: false, default: 24
  t.integer :max_value_size, null: false, default: 1000
  t.timestamps
end

add_index :memories, :label, unique: true
```

#### 1f. `create_memory_entries`

```ruby
create_table :memory_entries do |t|
  t.string :memory_id, null: false
  t.text   :value,     null: false
  t.timestamps
end

add_index :memory_entries, [:memory_id, :created_at]
add_foreign_key :memory_entries, :memories
```

#### 1g. `create_calendars`

```ruby
create_table :calendars, id: :string, force: :cascade do |t|
  t.string :label,            null: false
  t.string :calendar_id,      null: false
  t.string :credentials_file, null: false
  t.timestamps
end
```

#### 1h. `create_whats_app_groups`

```ruby
create_table :whats_app_groups, primary_key: :jid, id: :string, force: :cascade do |t|
  t.string :name,  null: false
  t.string :label, null: false, default: ""
  t.timestamps
end
```

#### 1i. `create_whats_app_settings`

```ruby
create_table :whats_app_settings, id: :string, force: :cascade do |t|
  t.string :phone_number, null: false, default: ""
  t.timestamps
end
```

Only one row is ever written (id `"default"`). The model exposes a
`WhatsAppSetting.current` class method that finds-or-creates it.

---

### 2. Models

#### `Pipeline` — `rails/app/models/pipeline.rb`

```ruby
class Pipeline < ApplicationRecord
  self.implicit_order_column = "created_at"

  has_many :pipeline_steps, -> { order(:step_index) },
           dependent: :destroy, inverse_of: :pipeline
  has_many :triggers, dependent: :destroy
  has_many :run_records, foreign_key: :pipeline_id, primary_key: :id

  validates :id,   presence: true
  validates :name, presence: true

  accepts_nested_attributes_for :pipeline_steps, allow_destroy: true

  scope :ordered, -> { order(:name) }
end
```

`id` is assigned before creation: `before_validation :assign_id`.
Use `SecureRandom.uuid` if `id` is blank.

#### `PipelineStep` — `rails/app/models/pipeline_step.rb`

```ruby
class PipelineStep < ApplicationRecord
  belongs_to :pipeline

  validates :step_index,  presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :agent_type,  presence: true
  validates :config,      presence: true
  validates :step_index,  uniqueness: { scope: :pipeline_id }

  AGENT_TYPES = %w[
    llm_agent browser_agent calendar_agent
    whatsapp_agent whatsapp_group_send
    memory_agent debug_agent
  ].freeze

  validates :agent_type, inclusion: { in: AGENT_TYPES }

  scope :ordered, -> { order(:step_index) }
end
```

#### `Trigger` — `rails/app/models/trigger.rb`

```ruby
class Trigger < ApplicationRecord
  belongs_to :pipeline

  enum trigger_type: { cron: 0, whatsapp: 1, wa_group: 2 }

  validates :id,           presence: true
  validates :trigger_type, presence: true
  validates :cron_expr,    presence: true, if: :cron?
  validates :pipeline_id,  presence: true
  validates :enabled,      inclusion: { in: [true, false] }

  before_validation :assign_id

  scope :enabled,    -> { where(enabled: true) }
  scope :cron_type,  -> { cron }
  scope :wa_types,   -> { where(trigger_type: [:whatsapp, :wa_group]) }

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end
end
```

#### `RunRecord` — `rails/app/models/run_record.rb`

```ruby
class RunRecord < ApplicationRecord
  STATUSES = %w[success error running].freeze

  validates :pipeline_id,   presence: true
  validates :pipeline_name, presence: true
  validates :timestamp,     presence: true
  validates :status,        presence: true, inclusion: { in: STATUSES }

  scope :for_pipeline, ->(pid) { where(pipeline_id: pid) }
  scope :recent,       -> { order(timestamp: :desc) }
  scope :succeeded,    -> { where(status: "success") }
  scope :failed,       -> { where(status: "error") }
end
```

#### `Memory` — `rails/app/models/memory.rb`

```ruby
class Memory < ApplicationRecord
  has_many :memory_entries, dependent: :destroy

  validates :id,             presence: true
  validates :label,          presence: true, uniqueness: true
  validates :max_memories,   numericality: { only_integer: true, greater_than: 0 }
  validates :ttl_hours,      numericality: { only_integer: true, greater_than: 0 }
  validates :max_value_size, numericality: { only_integer: true, greater_than: 0 }

  before_validation :assign_id

  scope :by_label, ->(lbl) { find_by!(label: lbl) }

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end
end
```

#### `MemoryEntry` — `rails/app/models/memory_entry.rb`

```ruby
class MemoryEntry < ApplicationRecord
  belongs_to :memory

  validates :memory_id, presence: true
  validates :value,     presence: true

  scope :recent,       -> { order(created_at: :desc) }
  scope :within_ttl,   ->(hours) { where("created_at > ?", hours.hours.ago) }
end
```

#### `Calendar` — `rails/app/models/calendar.rb`

```ruby
class Calendar < ApplicationRecord
  validates :id,               presence: true
  validates :label,            presence: true
  validates :calendar_id,      presence: true
  validates :credentials_file, presence: true

  before_validation :assign_id

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end
end
```

#### `WhatsAppGroup` — `rails/app/models/whats_app_group.rb`

```ruby
class WhatsAppGroup < ApplicationRecord
  self.primary_key = "jid"

  validates :jid,  presence: true
  validates :name, presence: true

  scope :labeled, -> { where.not(label: ["", nil]) }
end
```

#### `WhatsAppSetting` — `rails/app/models/whats_app_setting.rb`

```ruby
class WhatsAppSetting < ApplicationRecord
  DEFAULT_ID = "default"

  validates :phone_number, presence: false  # may be blank until configured

  def self.current
    find_or_create_by!(id: DEFAULT_ID) do |s|
      s.phone_number = ""
    end
  end
end
```

---

### 3. Seeds file

`rails/db/seeds.rb` — creates enough data to exercise development without
external services.

```ruby
# Sample pipeline with two steps
pipeline = Pipeline.find_or_create_by!(id: "seed-pipeline-001") do |p|
  p.name = "Demo Pipeline"
end

pipeline.pipeline_steps.destroy_all
pipeline.pipeline_steps.create!(
  [
    { step_index: 0, agent_type: "llm_agent",   config: { prompt: "Summarise: {{input}}" } },
    { step_index: 1, agent_type: "debug_agent", config: {} }
  ]
)

# Cron trigger — every day at 08:00
Trigger.find_or_create_by!(id: "seed-trigger-cron-001") do |t|
  t.pipeline    = pipeline
  t.trigger_type = :cron
  t.cron_expr   = "0 8 * * *"
  t.enabled     = false
end

# WhatsApp trigger
Trigger.find_or_create_by!(id: "seed-trigger-wa-001") do |t|
  t.pipeline     = pipeline
  t.trigger_type = :whatsapp
  t.config       = { phone: "+15550001234" }
  t.enabled      = false
end

# Memory config
Memory.find_or_create_by!(label: "general") do |m|
  m.id             = "seed-memory-001"
  m.max_memories   = 50
  m.ttl_hours      = 48
  m.max_value_size = 500
end

# WhatsApp settings skeleton
WhatsAppSetting.current
```

---

### 4. Model specs

All specs live under `rails/spec/models/`. Use `shoulda-matchers` for
association and validation one-liners; write explicit examples for custom
scopes and class methods.

#### Key spec cases (implement for every model)

**Pipeline**
- `validates :name` — invalid without name
- `has_many :pipeline_steps` association
- `has_many :triggers` association
- `scope :ordered` — returns records sorted by name
- `before_validation` assigns a UUID `id` when blank

**PipelineStep**
- `validates :agent_type` inclusion — rejects unknown type
- `validates :step_index` uniqueness scoped to `pipeline_id`
- `belongs_to :pipeline`

**Trigger**
- `enum trigger_type` — `cron?`, `whatsapp?`, `wa_group?` predicates work
- `validates :cron_expr` only required when `cron?`
- `scope :enabled` — excludes `enabled: false` records
- `scope :wa_types` — returns only whatsapp + wa_group

**RunRecord**
- `validates :status` inclusion
- `scope :for_pipeline` filters correctly
- `scope :recent` orders by timestamp desc

**Memory**
- `validates :label` uniqueness
- `has_many :memory_entries`

**MemoryEntry**
- `scope :within_ttl` excludes expired entries
- `belongs_to :memory`

**WhatsAppSetting**
- `WhatsAppSetting.current` returns the same record on repeated calls

---

## File / class list

| Path | Description |
|---|---|
| `rails/db/migrate/YYYYMMDDHHMMSS_create_pipelines.rb` | Pipelines table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_pipeline_steps.rb` | PipelineSteps table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_triggers.rb` | Triggers table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_run_records.rb` | RunRecords table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_memories.rb` | Memories table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_memory_entries.rb` | MemoryEntries table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_calendars.rb` | Calendars table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_whats_app_groups.rb` | WhatsAppGroups table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_whats_app_settings.rb` | WhatsAppSettings table |
| `rails/app/models/pipeline.rb` | Pipeline AR model |
| `rails/app/models/pipeline_step.rb` | PipelineStep AR model |
| `rails/app/models/trigger.rb` | Trigger AR model with enum |
| `rails/app/models/run_record.rb` | RunRecord AR model |
| `rails/app/models/memory.rb` | Memory AR model |
| `rails/app/models/memory_entry.rb` | MemoryEntry AR model |
| `rails/app/models/calendar.rb` | Calendar AR model |
| `rails/app/models/whats_app_group.rb` | WhatsAppGroup AR model (custom PK) |
| `rails/app/models/whats_app_setting.rb` | WhatsAppSetting AR model + `.current` |
| `rails/db/seeds.rb` | Development seed data |
| `rails/spec/models/pipeline_spec.rb` | Pipeline model specs |
| `rails/spec/models/pipeline_step_spec.rb` | PipelineStep model specs |
| `rails/spec/models/trigger_spec.rb` | Trigger model specs |
| `rails/spec/models/run_record_spec.rb` | RunRecord model specs |
| `rails/spec/models/memory_spec.rb` | Memory model specs |
| `rails/spec/models/memory_entry_spec.rb` | MemoryEntry model specs |
| `rails/spec/models/whats_app_setting_spec.rb` | WhatsAppSetting model specs |

---

## Acceptance criteria

- [ ] `rails db:migrate` runs without errors on a fresh database
- [ ] `rails db:schema:dump` produces a `schema.rb` that matches the column
      types described above
- [ ] `rails db:seed` runs without errors
- [ ] `rails runner "Pipeline.count"` returns `1` after seeding
- [ ] All nine models are loadable via `rails console` without errors
- [ ] `bundle exec rspec spec/models` passes with zero failures
- [ ] Trigger enum works: `Trigger.cron`, `Trigger.whatsapp`, `Trigger.wa_group`
      return correct AR relations
- [ ] `WhatsAppSetting.current` called twice returns the same record without
      creating a duplicate
