class CreateWhatsAppGroups < ActiveRecord::Migration[7.1]
  def change
    create_table :whats_app_groups, primary_key: :jid, id: :string, force: :cascade do |t|
      t.string :name,  null: false
      t.string :label, null: false, default: ""
      t.timestamps
    end
  end
end