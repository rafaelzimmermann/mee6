RSpec.describe WhatsAppGroup, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:jid) }
    it { is_expected.to validate_presence_of(:name) }

    it "uses jid as primary key" do
      group = create(:whats_app_group, jid: "test-jid@g.us")
      expect(WhatsAppGroup.primary_key).to eq("jid")
      expect(group.id).to eq("test-jid@g.us")
    end
  end

  describe "scopes" do
    describe ".labeled" do
      it "returns groups with non-empty labels" do
        create(:whats_app_group, jid: "1@g.us", name: "Group 1", label: "Label 1")
        create(:whats_app_group, jid: "2@g.us", name: "Group 2", label: "")
        create(:whats_app_group, jid: "3@g.us", name: "Group 3", label: "")
        create(:whats_app_group, jid: "4@g.us", name: "Group 4", label: "Label 4")

        labeled_groups = WhatsAppGroup.labeled
        expect(labeled_groups.count).to eq(2)
        expect(labeled_groups.pluck(:jid)).to match_array(%w[1@g.us 4@g.us])
      end
    end
  end
end
