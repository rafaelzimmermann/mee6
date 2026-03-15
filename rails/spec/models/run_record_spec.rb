RSpec.describe RunRecord, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:pipeline_id) }
    it { is_expected.to validate_presence_of(:pipeline_name) }
    it { is_expected.to validate_presence_of(:timestamp) }
    it { is_expected.to validate_presence_of(:status) }

    it "validates status inclusion" do
      valid_statuses = %w[success error running]
      valid_statuses.each do |status|
        record = build(:run_record, status: status)
        expect(record).to be_valid
      end

      invalid_record = build(:run_record, status: "invalid_status")
      expect(invalid_record).not_to be_valid
      expect(invalid_record.errors[:status]).to include("is not included in the list")
    end
  end

  describe "scopes" do
    describe ".for_pipeline" do
      it "filters records by pipeline_id" do
        pipeline1 = create(:pipeline)
        pipeline2 = create(:pipeline)

        create(:run_record, pipeline_id: pipeline1.id, pipeline_name: pipeline1.name)
        create(:run_record, pipeline_id: pipeline1.id, pipeline_name: pipeline1.name)
        create(:run_record, pipeline_id: pipeline2.id, pipeline_name: pipeline2.name)

        expect(RunRecord.for_pipeline(pipeline1.id).count).to eq(2)
        expect(RunRecord.for_pipeline(pipeline2.id).count).to eq(1)
      end
    end

    describe ".recent" do
      it "orders records by timestamp descending" do
        record1 = create(:run_record, timestamp: 1.day.ago)
        record2 = create(:run_record, timestamp: 2.days.ago)
        record3 = create(:run_record, timestamp: Time.current)

        expect(RunRecord.recent.to_a).to eq([record3, record1, record2])
      end
    end

    describe ".succeeded" do
      it "returns only successful records" do
        create(:run_record, status: "success")
        create(:run_record, status: "error")
        create(:run_record, status: "running")
        create(:run_record, status: "success")

        expect(RunRecord.succeeded.count).to eq(2)
        expect(RunRecord.succeeded.pluck(:status)).to all(eq("success"))
      end
    end

    describe ".failed" do
      it "returns only failed records" do
        create(:run_record, status: "success")
        create(:run_record, status: "error")
        create(:run_record, status: "running")
        create(:run_record, status: "error")

        expect(RunRecord.failed.count).to eq(2)
        expect(RunRecord.failed.pluck(:status)).to all(eq("error"))
      end
    end
  end
end
