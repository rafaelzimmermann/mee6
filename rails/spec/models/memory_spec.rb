RSpec.describe Memory, type: :model do
  describe "associations" do
    it { is_expected.to have_many(:memory_entries).dependent(:destroy) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:label) }

    it "validates label uniqueness" do
      create(:memory, label: "test-label")
      duplicate = build(:memory, label: "test-label")
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:label]).to include("has already been taken")
    end

    it "validates max_memories" do
      memory = build(:memory, max_memories: -1)
      expect(memory).not_to be_valid
      expect(memory.errors[:max_memories]).to include("must be greater than 0")

      memory = build(:memory, max_memories: 0)
      expect(memory).not_to be_valid

      memory = build(:memory, max_memories: 1)
      expect(memory).to be_valid
    end

    it "validates ttl_hours" do
      memory = build(:memory, ttl_hours: -1)
      expect(memory).not_to be_valid
      expect(memory.errors[:ttl_hours]).to include("must be greater than 0")

      memory = build(:memory, ttl_hours: 0)
      expect(memory).not_to be_valid

      memory = build(:memory, ttl_hours: 1)
      expect(memory).to be_valid
    end

    it "validates max_value_size" do
      memory = build(:memory, max_value_size: -1)
      expect(memory).not_to be_valid
      expect(memory.errors[:max_value_size]).to include("must be greater than 0")

      memory = build(:memory, max_value_size: 0)
      expect(memory).not_to be_valid

      memory = build(:memory, max_value_size: 1)
      expect(memory).to be_valid
    end

    it "assigns a UUID id before validation when blank" do
      memory = build(:memory, id: nil)
      memory.valid?
      expect(memory.id).to be_present
      expect(memory.id).to match(/^[0-9a-f-]{36}$/)
    end
  end

  describe "scopes" do
    describe ".by_label" do
      it "finds memory by label" do
        memory = create(:memory, label: "test-label")
        found_memory = Memory.by_label("test-label")

        expect(found_memory).to eq(memory)
      end

      it "raises error if not found" do
        expect {
          Memory.by_label("nonexistent")
        }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end
end
