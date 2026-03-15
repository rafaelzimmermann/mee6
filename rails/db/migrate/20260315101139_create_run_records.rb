class CreateRunRecords < ActiveRecord::Migration[7.1]
  def change
    create_table :run_records do |t|
      t.string   :pipeline_id,   null: false
      t.string   :pipeline_name, null: false
      t.datetime :timestamp,     null: false
      t.string   :status,        null: false
      t.text     :summary
      t.timestamps
    end

    add_index :run_records, [:pipeline_id, :timestamp]
  end
end