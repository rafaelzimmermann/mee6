RSpec.describe Pipeline, type: :model do
  describe "associations" do
    it { is_expected.to have_many(:pipeline_steps).dependent(:destroy).inverse_of(:pipeline) }
    it { is_expected.to have_many(:triggers).dependent(:destroy) }
    it { is_expected.to have_many(:run_records) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:name) }

    it "assigns a UUID id before validation when blank" do
      pipeline = build(:pipeline, id: nil)
      pipeline.valid?
      expect(pipeline.id).to be_present
      expect(pipeline.id).to match(/^[0-9a-f-]{36}$/)
    end
  end

  describe "scopes" do
    describe ".ordered" do
      it "returns records sorted by name" do
        create(:pipeline, name: "Zebra Pipeline")
        create(:pipeline, name: "Alpha Pipeline")
        create(:pipeline, name: "Middle Pipeline")

        expect(Pipeline.ordered.pluck(:name)).to eq(["Alpha Pipeline", "Middle Pipeline", "Zebra Pipeline"])
      end
    end
  end

  describe "nested attributes" do
    it { is_expected.to accept_nested_attributes_for(:pipeline_steps).allow_destroy(true) }
  end
end
