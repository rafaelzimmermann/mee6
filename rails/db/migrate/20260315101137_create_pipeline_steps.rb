class CreatePipelineSteps < ActiveRecord::Migration[7.1]
  def change
    create_table :pipeline_steps do |t|
      t.string  :pipeline_id, null: false
      t.integer :step_index,  null: false
      t.string  :agent_type,  null: false
      t.jsonb   :config,      null: false, default: {}
      t.timestamps
    end

    add_index :pipeline_steps, [:pipeline_id, :step_index], unique: true
    add_foreign_key :pipeline_steps, :pipelines
  end
end