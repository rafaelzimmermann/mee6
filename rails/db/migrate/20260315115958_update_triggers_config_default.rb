class UpdateTriggersConfigDefault < ActiveRecord::Migration[8.1]
  def change
    change_column :triggers, :config, :jsonb, default: nil, null: false
  end
end
