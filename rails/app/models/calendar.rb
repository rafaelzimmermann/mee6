class Calendar < ApplicationRecord
  validates :id,               presence: true
  validates :label,            presence: true
  validates :calendar_id,      presence: true
  validates :credentials_file, presence: true

  before_validation :assign_id

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end
end