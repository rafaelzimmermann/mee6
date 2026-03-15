class CreateTriggers < ActiveRecord::Migration[7.1]
  def change
    create_table :triggers, id: :string, force: :cascade do |t|
      t.string  :pipeline_id,   null: false
      t.integer :trigger_type,  null: false
      t.string  :cron_expr
      t.jsonb   :config,        null: false, default: {}
      t.boolean :enabled,       null: false, default: true
      t.timestamps
    end

    add_foreign_key :triggers, :pipelines
  end
end