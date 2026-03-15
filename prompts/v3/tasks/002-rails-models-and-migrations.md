# Task 002 — Rails Models and Migrations

## Goal

Define all nine ActiveRecord models with associations, validations, and scopes.
Write Rails migrations that produce a schema matching the v2 database layout as
closely as possible so that data can be copied across without transformation.
Provide a seeds file for local development, FactoryBot factories, and full model
specs.

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
  t.jsonb   :config,      null: false, default: {}  # DB default only; model requires non-empty (see note below)
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
  t.jsonb   :config,        null: false, default: {}  # DB default only; see note below
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

> **Config validation note**: `validates :config, presence: true` on
> `PipelineStep` rejects empty hashes because `{}.blank? # => true` in
> ActiveSupport. The `default: {}` in the migration is a DB-level safety net
> only. All code that creates steps or triggers (factories, seeds, application
> code) must always supply a non-empty `config` hash.

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

  before_validation :assign_id

  scope :ordered, -> { order(:name) }

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end
end
```

#### `PipelineStep` — `rails/app/models/pipeline_step.rb`

```ruby
class PipelineStep < ApplicationRecord
  belongs_to :pipeline

  AGENT_TYPES = %w[
    llm_agent browser_agent calendar_agent
    whatsapp_agent whatsapp_group_send
    memory_agent debug_agent
  ].freeze

  validates :step_index,  presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :agent_type,  presence: true, inclusion: { in: AGENT_TYPES }
  validates :config,      presence: true
  validates :step_index,  uniqueness: { scope: :pipeline_id }

  scope :ordered, -> { order(:step_index) }
end
```

#### `Trigger` — `rails/app/models/trigger.rb`

```ruby
class Trigger < ApplicationRecord
  belongs_to :pipeline

  enum :trigger_type, { cron: 0, whatsapp: 1, wa_group: 2 }

  validates :id,           presence: true
  validates :trigger_type, presence: true
  validates :pipeline_id,  presence: true
  validates :cron_expr,    presence: true, if: :cron?
  validates :enabled,      inclusion: { in: [true, false] }

  before_validation :assign_id

  scope :enabled,   -> { where(enabled: true) }
  scope :cron_type, -> { cron }
  scope :wa_types,  -> { where(trigger_type: [:whatsapp, :wa_group]) }

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

  scope :recent,     -> { order(created_at: :desc) }
  scope :within_ttl, ->(hours) { where("created_at > ?", hours.hours.ago) }
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

  # phone_number may be blank until the device is linked
  validates :phone_number, presence: false

  def self.current
    find_or_create_by!(id: DEFAULT_ID) do |s|
      s.phone_number = ""
    end
  end
end
```

---

### 3. Seeds file — `rails/db/seeds.rb`

```ruby
# Sample pipeline with two steps
pipeline = Pipeline.find_or_create_by!(id: "seed-pipeline-001") do |p|
  p.name = "Demo Pipeline"
end

pipeline.pipeline_steps.destroy_all
pipeline.pipeline_steps.create!(step_index: 0, agent_type: "llm_agent",   config: { prompt: "Summarise: {{input}}" })
pipeline.pipeline_steps.create!(step_index: 1, agent_type: "debug_agent", config: { debug: true })

# Cron trigger — every day at 08:00
Trigger.find_or_create_by!(id: "seed-trigger-cron-001") do |t|
  t.pipeline     = pipeline
  t.trigger_type = :cron
  t.cron_expr    = "0 8 * * *"
  t.enabled      = false
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

### 4. FactoryBot factories

Create one file per model under `rails/spec/factories/`. Use traits for
agent types and trigger variants.

**`spec/factories/pipelines.rb`**
```ruby
FactoryBot.define do
  factory :pipeline do
    id   { SecureRandom.uuid }
    name { Faker::Lorem.words(number: 3).join(" ").titleize }
  end
end
```

**`spec/factories/pipeline_steps.rb`**
```ruby
FactoryBot.define do
  factory :pipeline_step do
    pipeline
    step_index { 0 }
    agent_type { "llm_agent" }
    config     { { test: true } }   # non-empty: {}.blank? == true in Rails

    trait :llm_agent          do; agent_type { "llm_agent" };          config { { prompt: "Summarise: {{input}}" } }; end
    trait :browser_agent      do; agent_type { "browser_agent" };      config { { url: "https://example.com" } }; end
    trait :calendar_agent     do; agent_type { "calendar_agent" };     config { { calendar_id: "primary" } }; end
    trait :whatsapp_agent     do; agent_type { "whatsapp_agent" };     config { { phone: "+15550193456" } }; end
    trait :whatsapp_group_send do; agent_type { "whatsapp_group_send" }; config { { group_jid: "1234567890@g.us" } }; end
    trait :memory_agent       do; agent_type { "memory_agent" };       config { { memory_label: "general" } }; end
    trait :debug_agent        do; agent_type { "debug_agent" };        config { { debug: true } }; end
  end
end
```

**`spec/factories/triggers.rb`**
```ruby
FactoryBot.define do
  factory :trigger do
    id           { SecureRandom.uuid }
    pipeline
    trigger_type { :cron }
    cron_expr    { "0 8 * * *" }
    config       { { test: true } }   # non-empty: see config validation note
    enabled      { true }

    trait :cron     do; trigger_type { :cron };     cron_expr { "0 8 * * *" }; end
    trait :whatsapp do; trigger_type { :whatsapp }; config { { phone: "+15550193456" } }; end
    trait :wa_group do; trigger_type { :wa_group }; config { { group_jid: "1234567890@g.us" } }; end
    trait :disabled do; enabled { false }; end
  end
end
```

**`spec/factories/run_records.rb`**
```ruby
FactoryBot.define do
  factory :run_record do
    pipeline_id   { SecureRandom.uuid }
    pipeline_name { Faker::Lorem.words(number: 3).join(" ").titleize }
    timestamp     { Time.current }
    status        { "success" }
    summary       { Faker::Lorem.sentence }

    trait :success do; status { "success" }; end
    trait :error   do; status { "error" };   end
    trait :running do; status { "running" }; end
  end
end
```

**`spec/factories/memories.rb`**
```ruby
FactoryBot.define do
  factory :memory do
    id             { SecureRandom.uuid }
    label          { "general" }
    max_memories   { 100 }
    ttl_hours      { 24 }
    max_value_size { 1000 }
  end
end
```

**`spec/factories/memory_entries.rb`**
```ruby
FactoryBot.define do
  factory :memory_entry do
    memory
    value { Faker::Lorem.paragraph }
  end
end
```

**`spec/factories/calendars.rb`**
```ruby
FactoryBot.define do
  factory :calendar do
    id               { SecureRandom.uuid }
    label            { "primary" }
    calendar_id      { "primary" }
    credentials_file { "credentials.json" }
  end
end
```

**`spec/factories/whats_app_groups.rb`**
```ruby
FactoryBot.define do
  factory :whats_app_group do
    jid   { "#{Faker::Number.unique.number(digits: 10)}@g.us" }
    name  { Faker::Lorem.words(number: 3).join(" ").titleize }
    label { "" }
  end
end
```

**`spec/factories/whats_app_settings.rb`**
```ruby
FactoryBot.define do
  factory :whats_app_setting do
    id           { "default" }
    phone_number { "" }
  end
end
```

---

### 5. Model specs

All specs live under `rails/spec/models/`. Use `shoulda-matchers` for
association and validation one-liners; write explicit examples for scopes,
class methods, and enum behaviour.

**Pipeline** — associations, `validates :name`, `scope :ordered`, UUID
auto-assignment, `accepts_nested_attributes_for :pipeline_steps`.

**PipelineStep** — `belongs_to :pipeline`, agent_type inclusion (valid and
invalid), `validates :config` presence, uniqueness of `step_index` scoped to
`pipeline_id`.

**Trigger** — `belongs_to :pipeline`, enum predicates (`cron?`, `whatsapp?`,
`wa_group?`), enum scopes (`Trigger.cron`, `.whatsapp`, `.wa_group`),
`cron_expr` required only for cron, `.enabled` scope, `.wa_types` scope, UUID
auto-assignment.

**RunRecord** — `validates :status` inclusion, `scope :for_pipeline`, `scope
:recent` (orders by timestamp desc), `scope :succeeded`, `scope :failed`.

**Memory** — `has_many :memory_entries`, `validates :label` uniqueness,
numeric validations reject `<= 0`, UUID auto-assignment, `scope :by_label`
raises `RecordNotFound` when missing.

**MemoryEntry** — `belongs_to :memory`, `validates :value` presence,
`scope :within_ttl` excludes entries older than the given hours.

**Calendar** — all presence validations, UUID auto-assignment.

**WhatsAppGroup** — custom primary key `jid`, `validates :name`, `scope
:labeled` excludes blank labels.

**WhatsAppSetting** — `phone_number` blank is valid, `.current` returns
same record on repeated calls without creating duplicates, `DEFAULT_ID`
constant equals `"default"`.

---

## File / class list

| Path | Description |
|---|---|
| `rails/db/migrate/YYYYMMDDHHMMSS_create_pipelines.rb` | pipelines table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_pipeline_steps.rb` | pipeline_steps table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_triggers.rb` | triggers table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_run_records.rb` | run_records table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_memories.rb` | memories table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_memory_entries.rb` | memory_entries table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_calendars.rb` | calendars table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_whats_app_groups.rb` | whats_app_groups table |
| `rails/db/migrate/YYYYMMDDHHMMSS_create_whats_app_settings.rb` | whats_app_settings table |
| `rails/app/models/pipeline.rb` | Pipeline model |
| `rails/app/models/pipeline_step.rb` | PipelineStep model |
| `rails/app/models/trigger.rb` | Trigger model with enum |
| `rails/app/models/run_record.rb` | RunRecord model |
| `rails/app/models/memory.rb` | Memory model |
| `rails/app/models/memory_entry.rb` | MemoryEntry model |
| `rails/app/models/calendar.rb` | Calendar model |
| `rails/app/models/whats_app_group.rb` | WhatsAppGroup model (custom PK) |
| `rails/app/models/whats_app_setting.rb` | WhatsAppSetting model + `.current` |
| `rails/db/seeds.rb` | Development seed data |
| `rails/spec/factories/pipelines.rb` | Pipeline factory |
| `rails/spec/factories/pipeline_steps.rb` | PipelineStep factory with agent traits |
| `rails/spec/factories/triggers.rb` | Trigger factory with type traits |
| `rails/spec/factories/run_records.rb` | RunRecord factory with status traits |
| `rails/spec/factories/memories.rb` | Memory factory |
| `rails/spec/factories/memory_entries.rb` | MemoryEntry factory |
| `rails/spec/factories/calendars.rb` | Calendar factory |
| `rails/spec/factories/whats_app_groups.rb` | WhatsAppGroup factory |
| `rails/spec/factories/whats_app_settings.rb` | WhatsAppSetting factory |
| `rails/spec/models/pipeline_spec.rb` | Pipeline model specs |
| `rails/spec/models/pipeline_step_spec.rb` | PipelineStep model specs |
| `rails/spec/models/trigger_spec.rb` | Trigger model specs |
| `rails/spec/models/run_record_spec.rb` | RunRecord model specs |
| `rails/spec/models/memory_spec.rb` | Memory model specs |
| `rails/spec/models/memory_entry_spec.rb` | MemoryEntry model specs |
| `rails/spec/models/calendar_spec.rb` | Calendar model specs |
| `rails/spec/models/whats_app_group_spec.rb` | WhatsAppGroup model specs |
| `rails/spec/models/whats_app_setting_spec.rb` | WhatsAppSetting model specs |

---

## Acceptance criteria

- [ ] `rails db:migrate` runs without errors on a fresh database
- [ ] `rails db:schema:dump` produces a `schema.rb` matching the column types
      described above
- [ ] `rails db:seed` runs without errors
- [ ] `rails runner "Pipeline.count"` returns `1` after seeding
- [ ] All nine models load in `rails console` without errors
- [ ] `bundle exec rspec spec/models` passes with zero failures
- [ ] Trigger enum works: `Trigger.cron`, `Trigger.whatsapp`, `Trigger.wa_group`
      return correct AR relations
- [ ] `WhatsAppSetting.current` called twice returns the same record without
      creating a duplicate
