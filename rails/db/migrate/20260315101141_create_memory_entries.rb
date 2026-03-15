class CreateMemoryEntries < ActiveRecord::Migration[7.1]
  def change
    create_table :memory_entries do |t|
      t.string :memory_id, null: false
      t.text   :value,     null: false
      t.timestamps
    end

    add_index :memory_entries, [:memory_id, :created_at]
    add_foreign_key :memory_entries, :memories
  end
end