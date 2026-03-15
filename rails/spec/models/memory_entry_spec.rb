RSpec.describe MemoryEntry, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:memory) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:memory_id) }
    it { is_expected.to validate_presence_of(:value) }
  end

  describe "scopes" do
    describe ".recent" do
      it "orders entries by created_at descending" do
        memory = create(:memory)
        entry1 = create(:memory_entry, memory: memory, created_at: 1.day.ago)
        entry2 = create(:memory_entry, memory: memory, created_at: 2.days.ago)
        entry3 = create(:memory_entry, memory: memory, created_at: Time.current)

        expect(MemoryEntry.recent.to_a).to eq([entry3, entry1, entry2])
      end
    end

    describe ".within_ttl" do
      it "includes entries created within the specified hours" do
        memory = create(:memory)
        old_entry = create(:memory_entry, memory: memory, created_at: 25.hours.ago)
        recent_entry = create(:memory_entry, memory: memory, created_at: 23.hours.ago)

        expect(MemoryEntry.within_ttl(24)).to include(recent_entry)
        expect(MemoryEntry.within_ttl(24)).not_to include(old_entry)
      end

      it "excludes entries older than the specified hours" do
        memory = create(:memory)
        entry1 = create(:memory_entry, memory: memory, created_at: 5.hours.ago)
        entry2 = create(:memory_entry, memory: memory, created_at: 3.hours.ago)
        entry3 = create(:memory_entry, memory: memory, created_at: 1.hour.ago)

        entries = MemoryEntry.within_ttl(4)
        expect(entries).to include(entry2, entry3)
        expect(entries).not_to include(entry1)
      end
    end
  end
end
