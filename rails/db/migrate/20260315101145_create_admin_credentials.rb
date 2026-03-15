class CreateAdminCredentials < ActiveRecord::Migration[7.1]
  def change
    create_table :admin_credentials do |t|
      t.string :password_digest, null: false
      t.timestamps
    end
  end
end