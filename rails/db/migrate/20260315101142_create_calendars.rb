class CreateCalendars < ActiveRecord::Migration[7.1]
  def change
    create_table :calendars, id: :string, force: :cascade do |t|
      t.string :label,            null: false
      t.string :calendar_id,      null: false
      t.string :credentials_file, null: false
      t.timestamps
    end
  end
end