class AdminCredential < ApplicationRecord
  has_secure_password validations: false

  # has_secure_password defines password_confirmation= but not the reader.
  # Without the reader the confirmation validator silently skips the check.
  attr_reader :password_confirmation

  validates :password, presence: true, length: { minimum: 8 }, on: :create
  validates :password, length: { minimum: 8 }, allow_nil: true, on: :update
  validates :password, confirmation: true,               on: :create
  validates :password, confirmation: true, allow_nil: true, on: :update

  def self.configured?
    exists?
  end

  def self.instance
    first
  end
end