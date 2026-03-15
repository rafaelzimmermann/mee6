# Task 014 — Data Migration from v2

## Goal

Write a Rails runner script that reads from the v2 PostgreSQL database and
populates the v3 database, respecting foreign key order, handling the v2
JSONB-steps-to-rows expansion, supporting dry-run mode, running idempotently
via upserts, and printing a post-migration row-count summary.

---

## Prerequisites

- Task 002 complete: all v3 migrations have been run and the schema is stable.
- Access to the v2 database via the `V2_DATABASE_URL` environment variable.

---

## Implementation steps

### 1. Script location and invocation

**`scripts/migrate_v2_to_v3.rb`**

Run with:

```bash
cd rails/
V2_DATABASE_URL="postgres://user:pass@host/v2_db" bundle exec rails runner ../scripts/migrate_v2_to_v3.rb
```

Dry-run:

```bash
V2_DATABASE_URL="..." V2_MIGRATE_DRY_RUN=true bundle exec rails runner ../scripts/migrate_v2_to_v3.rb
```

---

### 2. Script structure

```ruby
# scripts/migrate_v2_to_v3.rb
#
# Migrates data from a v2 PostgreSQL database to the v3 schema.
# Uses a raw PG connection for reads; writes through ActiveRecord models.
#
# Environment variables:
#   V2_DATABASE_URL      — required; connection string for the v2 database
#   V2_MIGRATE_DRY_RUN   — optional; set to "true" to log without writing

require "pg"

DRY_RUN = ENV.fetch("V2_MIGRATE_DRY_RUN", "false").downcase == "true"

if DRY_RUN
  puts "[dry-run] No writes will be performed."
end

V2_URL = ENV.fetch("V2_DATABASE_URL") do
  abort "ERROR: V2_DATABASE_URL is not set"
end

v2 = PG.connect(V2_URL)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg)
  puts msg
end

def upsert_or_log(model_class, find_by:, attributes:)
  if DRY_RUN
    log "[dry-run] Would upsert #{model_class.name} where #{find_by} with #{attributes.keys.inspect}"
    return
  end

  record = model_class.find_or_initialize_by(find_by)
  record.assign_attributes(attributes)
  record.save!(validate: false)   # skip validation; trust the source data
end
```

---

### 3. Migration order and logic

#### Step 1 — Pipelines

```ruby
log "\n=== Migrating pipelines ==="

rows = v2.exec("SELECT id, name, created_at, updated_at FROM pipelines")

rows.each do |row|
  upsert_or_log(
    Pipeline,
    find_by: { id: row["id"] },
    attributes: {
      name:       row["name"],
      created_at: row["created_at"],
      updated_at: row["updated_at"],
    }
  )
end

log "Processed #{rows.ntuples} pipeline(s)."
```

#### Step 2 — PipelineSteps

v2 pipelines may store steps in a `steps` JSONB column on the pipelines table
(legacy) or in a separate `pipeline_steps` table (newer v2 rows). The script
handles both:

```ruby
log "\n=== Migrating pipeline_steps ==="

# Check whether v2 has a separate pipeline_steps table.
has_steps_table = v2.exec(
  "SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_steps'"
).ntuples > 0

total = 0

if has_steps_table
  rows = v2.exec(<<~SQL)
    SELECT id, pipeline_id, step_index, agent_type, config::text, created_at, updated_at
    FROM pipeline_steps
    ORDER BY pipeline_id, step_index
  SQL

  rows.each do |row|
    upsert_or_log(
      PipelineStep,
      find_by: { id: row["id"].to_i },
      attributes: {
        pipeline_id: row["pipeline_id"],
        step_index:  row["step_index"].to_i,
        agent_type:  row["agent_type"],
        config:      JSON.parse(row["config"]),
        created_at:  row["created_at"],
        updated_at:  row["updated_at"],
      }
    )
    total += 1
  end
else
  # Expand JSONB steps column from pipelines table.
  # Assumes column is named "steps" and contains an array of step objects:
  # [{ "agent_type": "llm_agent", "config": { ... } }, ...]
  pipeline_rows = v2.exec("SELECT id, steps::text FROM pipelines WHERE steps IS NOT NULL")

  pipeline_rows.each do |row|
    steps = JSON.parse(row["steps"])
    steps.each_with_index do |step, index|
      upsert_or_log(
        PipelineStep,
        find_by: { pipeline_id: row["id"], step_index: index },
        attributes: {
          pipeline_id: row["id"],
          step_index:  index,
          agent_type:  step["agent_type"],
          config:      step["config"] || {},
        }
      )
      total += 1
    end
  end
end

log "Processed #{total} pipeline step(s)."
```

#### Step 3 — Triggers

```ruby
log "\n=== Migrating triggers ==="

# Map v2 trigger_type string values to v3 integer enum.
TRIGGER_TYPE_MAP = {
  "cron"      => 0,
  "whatsapp"  => 1,
  "wa_group"  => 2,
}.freeze

rows = v2.exec(<<~SQL)
  SELECT id, pipeline_id, trigger_type, cron_expr, config::text, enabled, created_at, updated_at
  FROM triggers
SQL

rows.each do |row|
  type_int = TRIGGER_TYPE_MAP.fetch(row["trigger_type"]) do
    log "WARNING: unknown trigger_type '#{row["trigger_type"]}' for trigger #{row["id"]} — skipping"
    next
  end

  upsert_or_log(
    Trigger,
    find_by: { id: row["id"] },
    attributes: {
      pipeline_id:  row["pipeline_id"],
      trigger_type: type_int,
      cron_expr:    row["cron_expr"],
      config:       JSON.parse(row["config"]),
      enabled:      row["enabled"] == "t",
      created_at:   row["created_at"],
      updated_at:   row["updated_at"],
    }
  )
end

log "Processed #{rows.ntuples} trigger(s)."
```

#### Step 4 — RunRecords

```ruby
log "\n=== Migrating run_records ==="

rows = v2.exec(<<~SQL)
  SELECT id, pipeline_id, pipeline_name, timestamp, status, summary, created_at, updated_at
  FROM run_records
  ORDER BY timestamp ASC
SQL

rows.each do |row|
  upsert_or_log(
    RunRecord,
    find_by: { id: row["id"].to_i },
    attributes: {
      pipeline_id:   row["pipeline_id"],
      pipeline_name: row["pipeline_name"],
      timestamp:     row["timestamp"],
      status:        row["status"],
      summary:       row["summary"],
      created_at:    row["created_at"],
      updated_at:    row["updated_at"],
    }
  )
end

log "Processed #{rows.ntuples} run record(s)."
```

#### Step 5 — Memory and MemoryEntries

```ruby
log "\n=== Migrating memories ==="

mem_rows = v2.exec(<<~SQL)
  SELECT id, label, max_memories, ttl_hours, max_value_size, created_at, updated_at
  FROM memories
SQL

mem_rows.each do |row|
  upsert_or_log(
    Memory,
    find_by: { id: row["id"] },
    attributes: {
      label:          row["label"],
      max_memories:   row["max_memories"].to_i,
      ttl_hours:      row["ttl_hours"].to_i,
      max_value_size: row["max_value_size"].to_i,
      created_at:     row["created_at"],
      updated_at:     row["updated_at"],
    }
  )
end

log "Processed #{mem_rows.ntuples} memory config(s)."

log "\n=== Migrating memory_entries ==="

entry_rows = v2.exec(<<~SQL)
  SELECT id, memory_id, value, created_at, updated_at
  FROM memory_entries
  ORDER BY created_at ASC
SQL

entry_rows.each do |row|
  upsert_or_log(
    MemoryEntry,
    find_by: { id: row["id"].to_i },
    attributes: {
      memory_id:  row["memory_id"],
      value:      row["value"],
      created_at: row["created_at"],
      updated_at: row["updated_at"],
    }
  )
end

log "Processed #{entry_rows.ntuples} memory entry(ies)."
```

#### Step 6 — Calendars

```ruby
log "\n=== Migrating calendars ==="

rows = v2.exec(<<~SQL)
  SELECT id, label, calendar_id, credentials_file, created_at, updated_at
  FROM calendars
SQL

rows.each do |row|
  upsert_or_log(
    Calendar,
    find_by: { id: row["id"] },
    attributes: {
      label:            row["label"],
      calendar_id:      row["calendar_id"],
      credentials_file: row["credentials_file"],
      created_at:       row["created_at"],
      updated_at:       row["updated_at"],
    }
  )
end

log "Processed #{rows.ntuples} calendar(s)."
```

#### Step 7 — WhatsAppGroups and WhatsAppSettings

```ruby
log "\n=== Migrating whatsapp_groups ==="

group_rows = v2.exec(<<~SQL)
  SELECT jid, name, label, created_at, updated_at
  FROM whatsapp_groups
SQL

group_rows.each do |row|
  upsert_or_log(
    WhatsAppGroup,
    find_by: { jid: row["jid"] },
    attributes: {
      name:       row["name"],
      label:      row["label"] || "",
      created_at: row["created_at"],
      updated_at: row["updated_at"],
    }
  )
end

log "Processed #{group_rows.ntuples} WhatsApp group(s)."

log "\n=== Migrating whatsapp_settings ==="

# v2 may store this as a single-row table or as individual config keys.
# Assume single-row table named whatsapp_settings with a phone_number column.
has_settings_table = v2.exec(
  "SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_settings'"
).ntuples > 0

if has_settings_table
  settings_rows = v2.exec("SELECT phone_number FROM whatsapp_settings LIMIT 1")

  if settings_rows.ntuples > 0 && !DRY_RUN
    setting = WhatsAppSetting.current
    setting.update!(phone_number: settings_rows[0]["phone_number"] || "")
    log "Updated WhatsAppSetting phone_number."
  elsif DRY_RUN
    log "[dry-run] Would update WhatsAppSetting phone_number."
  else
    log "No whatsapp_settings row found in v2; skipping."
  end
else
  log "No whatsapp_settings table in v2; skipping."
end
```

#### Skipped tables

```ruby
log "\n=== Skipped tables ==="
log "whatsapp_messages — dropped in v3 (event-driven refactor; messages are not stored)"
```

---

### 4. Post-migration summary

```ruby
# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "\n#{"=" * 60}"
log "MIGRATION SUMMARY"
log "=" * 60

if DRY_RUN
  log "(dry-run mode — no rows were written)"
else
  summary = {
    "pipelines"       => Pipeline.count,
    "pipeline_steps"  => PipelineStep.count,
    "triggers"        => Trigger.count,
    "run_records"     => RunRecord.count,
    "memories"        => Memory.count,
    "memory_entries"  => MemoryEntry.count,
    "calendars"       => Calendar.count,
    "whatsapp_groups" => WhatsAppGroup.count,
  }

  summary.each do |table, count|
    log "  #{table.ljust(20)} #{count} row(s)"
  end
end

v2.close
log "\nDone."
```

---

### 5. Idempotency guarantee

The `upsert_or_log` helper calls `find_or_initialize_by` followed by
`assign_attributes` and `save!(validate: false)`. Running the script a second
time against the same v2 database:

- Does not create duplicate rows (finds existing record by primary key).
- Overwrites attributes with the same v2 values (no net change).
- Does not error on unique constraint violations.

For tables with integer auto-increment ids (`pipeline_steps`, `run_records`,
`memory_entries`), upsert is by the v2 `id` column. This requires that the v2
ids are stable (they are — v2 uses integer sequences).

---

### 6. `pg` gem dependency

Add to `rails/Gemfile` in the `development` and `production` groups (it is
already present as the database adapter, but make the dependency explicit for
`PG.connect`):

```ruby
gem "pg"   # already present as the Rails DB adapter; also used by migration script
```

No additional gem is required.

---

### 7. Testing the migration script

There is no automated spec for the migration script (it depends on a real v2
database connection). Instead, provide a manual test procedure:

1. Spin up a local Postgres instance with v2 schema and seed data.
2. Run with `V2_MIGRATE_DRY_RUN=true` — verify log output matches expected row
   counts, no database writes occur.
3. Run without dry-run — verify v3 row counts match v2 source counts.
4. Run again without dry-run — verify row counts are identical (idempotency).
5. Spot-check: query a migrated Pipeline and its PipelineSteps to confirm the
   JSONB expansion produced correct `step_index` ordering.

---

## File / class list

| Path | Description |
|---|---|
| `scripts/migrate_v2_to_v3.rb` | Rails runner script — full migration logic |

No new model files are created; the script writes through the existing AR models
defined in Task 002.

---

## Acceptance criteria

- [ ] Script exits with an error message if `V2_DATABASE_URL` is not set
- [ ] Running with `V2_MIGRATE_DRY_RUN=true` produces log output for every table and makes zero writes to the v3 database
- [ ] Running against a seeded v2 database populates all v3 tables with matching row counts
- [ ] Pipelines whose steps are stored as a JSONB column (no `pipeline_steps` table in v2) are expanded into individual `PipelineStep` rows with correct `step_index` values
- [ ] `whatsapp_messages` table is explicitly skipped and noted in the log output
- [ ] Running the script a second time against the same v2 database produces identical v3 row counts (idempotency)
- [ ] Post-migration summary prints row counts for all eight migrated tables
- [ ] `trigger_type` string values from v2 are correctly mapped to v3 integer enum values (0=cron, 1=whatsapp, 2=wa_group)
- [ ] Unknown `trigger_type` values log a WARNING and skip the row rather than raising an exception
- [ ] `WhatsAppSetting.phone_number` is populated from v2 `whatsapp_settings` if that table exists
