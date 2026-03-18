class CreateTelegramChats < ActiveRecord::Migration[7.1]
  def change
    create_table :telegram_chats, primary_key: :chat_id, id: :string, force: :cascade do |t|
      t.string :title,     null: false
      t.string :chat_type, null: false
      t.string :label,     null: false, default: ""
      t.timestamps
    end
  end
end
