class AdminCredential < ApplicationRecord
  has_secure_password validations: false

  validates :password, length: { minimum: 8 }, on: :create
  validates :password, length: { minimum: 8 }, allow_nil: true, on: :update

  def self.configured?
    exists?
  end

  def self.instance
    first
  end
end