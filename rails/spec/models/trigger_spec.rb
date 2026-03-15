RSpec.describe Trigger, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:pipeline) }
  end

  describe "enum" do
    it "defines trigger_type enum" do
      expect(Trigger.trigger_types).to eq({ "cron" => 0, "whatsapp" => 1, "wa_group" => 2 })
    end

    it "provides predicate methods for trigger_type" do
      cron_trigger = create(:trigger, trigger_type: :cron)
      wa_trigger = create(:trigger, trigger_type: :whatsapp)
      wa_group_trigger = create(:trigger, trigger_type: :wa_group)

      expect(cron_trigger).to be_cron
      expect(cron_trigger).not_to be_whatsapp
      expect(cron_trigger).not_to be_wa_group

      expect(wa_trigger).to be_whatsapp
      expect(wa_trigger).not_to be_cron
      expect(wa_trigger).not_to be_wa_group

      expect(wa_group_trigger).to be_wa_group
      expect(wa_group_trigger).not_to be_cron
      expect(wa_group_trigger).not_to be_whatsapp
    end

    it "provides scope methods for trigger_type" do
      create(:trigger, trigger_type: :cron)
      create(:trigger, trigger_type: :cron)
      create(:trigger, trigger_type: :whatsapp)
      create(:trigger, trigger_type: :wa_group)

      expect(Trigger.cron.count).to eq(2)
      expect(Trigger.whatsapp.count).to eq(1)
      expect(Trigger.wa_group.count).to eq(1)
    end
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:trigger_type) }
    it { is_expected.to validate_presence_of(:pipeline_id) }

    context "when cron trigger" do
      it "requires cron_expr" do
        cron_trigger = build(:trigger, trigger_type: :cron, cron_expr: nil)
        expect(cron_trigger).not_to be_valid
        expect(cron_trigger.errors[:cron_expr]).to include("can't be blank")
      end

      it "is valid with cron_expr" do
        cron_trigger = build(:trigger, trigger_type: :cron, cron_expr: "0 8 * * *")
        expect(cron_trigger).to be_valid
      end
    end

    context "when non-cron trigger" do
      it "does not require cron_expr" do
        wa_trigger = build(:trigger, trigger_type: :whatsapp, cron_expr: nil)
        expect(wa_trigger).to be_valid
      end
    end

    it "assigns a UUID id before validation when blank" do
      trigger = build(:trigger, id: nil)
      trigger.valid?
      expect(trigger.id).to be_present
      expect(trigger.id).to match(/^[0-9a-f-]{36}$/)
    end
  end

  describe "scopes" do
    describe ".enabled" do
      it "returns only enabled triggers" do
        create(:trigger, enabled: true)
        create(:trigger, enabled: false)
        create(:trigger, enabled: true)

        expect(Trigger.enabled.count).to eq(2)
        expect(Trigger.enabled.pluck(:enabled)).to all(be true)
      end
    end

    describe ".cron_type" do
      it "returns only cron triggers" do
        create(:trigger, trigger_type: :cron)
        create(:trigger, trigger_type: :whatsapp)
        create(:trigger, trigger_type: :wa_group)
        create(:trigger, trigger_type: :cron)

        expect(Trigger.cron_type.count).to eq(2)
        expect(Trigger.cron_type).to all(be_cron)
      end
    end

    describe ".wa_types" do
      it "returns only whatsapp and wa_group triggers" do
        create(:trigger, trigger_type: :cron)
        create(:trigger, trigger_type: :whatsapp)
        create(:trigger, trigger_type: :wa_group)
        create(:trigger, trigger_type: :cron)

        expect(Trigger.wa_types.count).to eq(2)
        expect(Trigger.wa_types.pluck(:trigger_type)).to include("whatsapp", "wa_group")
      end
    end
  end
end
