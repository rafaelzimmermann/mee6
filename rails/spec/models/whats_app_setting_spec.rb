RSpec.describe WhatsAppSetting, type: :model do
  describe "validations" do
    it "does not require phone_number to be present" do
      setting = build(:whats_app_setting, phone_number: "")
      expect(setting).to be_valid
    end

    it "allows phone_number to be nil" do
      setting = build(:whats_app_setting, phone_number: nil)
      expect(setting).to be_valid
    end
  end

  describe ".current" do
    it "finds or creates the default setting" do
      expect(WhatsAppSetting.count).to eq(0)

      current = WhatsAppSetting.current
      expect(current.id).to eq(WhatsAppSetting::DEFAULT_ID)
      expect(current.phone_number).to eq("")
      expect(WhatsAppSetting.count).to eq(1)
    end

    it "returns the same record on repeated calls without creating duplicates" do
      setting1 = WhatsAppSetting.current
      setting2 = WhatsAppSetting.current

      expect(setting1).to eq(setting2)
      expect(WhatsAppSetting.count).to eq(1)
    end

    it "finds existing record instead of creating new one" do
      existing = create(:whats_app_setting, id: WhatsAppSetting::DEFAULT_ID, phone_number: "+1234567890")

      current = WhatsAppSetting.current
      expect(current).to eq(existing)
      expect(current.phone_number).to eq("+1234567890")
      expect(WhatsAppSetting.count).to eq(1)
    end
  end

  describe "constants" do
    it "defines DEFAULT_ID constant" do
      expect(WhatsAppSetting::DEFAULT_ID).to eq("default")
    end
  end
end
