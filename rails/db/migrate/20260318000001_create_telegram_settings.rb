class CreateTelegramSettings < ActiveRecord::Migration[7.1]
  def change
    create_table :telegram_settings, id: :string, force: :cascade do |t|
      t.string :bot_token, null: false, default: ""
      t.timestamps
    end
  end
end
