class CreateWhatsAppSettings < ActiveRecord::Migration[7.1]
  def change
    create_table :whats_app_settings, id: :string, force: :cascade do |t|
      t.string :phone_number, null: false, default: ""
      t.timestamps
    end
  end
end