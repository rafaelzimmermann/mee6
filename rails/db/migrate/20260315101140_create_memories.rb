class CreateMemories < ActiveRecord::Migration[7.1]
  def change
    create_table :memories, id: :string, force: :cascade do |t|
      t.string  :label,          null: false
      t.integer :max_memories,   null: false, default: 100
      t.integer :ttl_hours,      null: false, default: 24
      t.integer :max_value_size, null: false, default: 1000
      t.timestamps
    end

    add_index :memories, :label, unique: true
  end
end