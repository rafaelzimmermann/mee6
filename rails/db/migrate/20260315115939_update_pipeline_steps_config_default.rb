class UpdatePipelineStepsConfigDefault < ActiveRecord::Migration[8.1]
  def change
    change_column :pipeline_steps, :config, :jsonb, default: nil, null: false
  end
end
