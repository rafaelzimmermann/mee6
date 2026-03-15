RSpec.describe Calendar, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:label) }
    it { is_expected.to validate_presence_of(:calendar_id) }
    it { is_expected.to validate_presence_of(:credentials_file) }

    it "assigns a UUID id before validation when blank" do
      calendar = build(:calendar, id: nil)
      calendar.valid?
      expect(calendar.id).to be_present
      expect(calendar.id).to match(/^[0-9a-f-]{36}$/)
    end
  end
end
