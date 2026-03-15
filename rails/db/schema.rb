# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_03_15_101145) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "admin_credentials", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "password_digest", null: false
    t.datetime "updated_at", null: false
  end

  create_table "calendars", id: :string, force: :cascade do |t|
    t.string "calendar_id", null: false
    t.datetime "created_at", null: false
    t.string "credentials_file", null: false
    t.string "label", null: false
    t.datetime "updated_at", null: false
  end

  create_table "memories", id: :string, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "label", null: false
    t.integer "max_memories", default: 100, null: false
    t.integer "max_value_size", default: 1000, null: false
    t.integer "ttl_hours", default: 24, null: false
    t.datetime "updated_at", null: false
    t.index ["label"], name: "index_memories_on_label", unique: true
  end

  create_table "memory_entries", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "memory_id", null: false
    t.datetime "updated_at", null: false
    t.text "value", null: false
    t.index ["memory_id", "created_at"], name: "index_memory_entries_on_memory_id_and_created_at"
  end

  create_table "pipeline_steps", force: :cascade do |t|
    t.string "agent_type", null: false
    t.jsonb "config", default: {}, null: false
    t.datetime "created_at", null: false
    t.string "pipeline_id", null: false
    t.integer "step_index", null: false
    t.datetime "updated_at", null: false
    t.index ["pipeline_id", "step_index"], name: "index_pipeline_steps_on_pipeline_id_and_step_index", unique: true
  end

  create_table "pipelines", id: :string, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
  end

  create_table "run_records", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "pipeline_id", null: false
    t.string "pipeline_name", null: false
    t.string "status", null: false
    t.text "summary"
    t.datetime "timestamp", null: false
    t.datetime "updated_at", null: false
    t.index ["pipeline_id", "timestamp"], name: "index_run_records_on_pipeline_id_and_timestamp"
  end

  create_table "triggers", id: :string, force: :cascade do |t|
    t.jsonb "config", default: {}, null: false
    t.datetime "created_at", null: false
    t.string "cron_expr"
    t.boolean "enabled", default: true, null: false
    t.string "pipeline_id", null: false
    t.integer "trigger_type", null: false
    t.datetime "updated_at", null: false
  end

  create_table "whats_app_groups", primary_key: "jid", id: :string, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "label", default: "", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
  end

  create_table "whats_app_settings", id: :string, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "phone_number", default: "", null: false
    t.datetime "updated_at", null: false
  end

  add_foreign_key "memory_entries", "memories"
  add_foreign_key "pipeline_steps", "pipelines"
  add_foreign_key "triggers", "pipelines"
end
