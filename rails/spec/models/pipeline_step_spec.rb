RSpec.describe PipelineStep, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:pipeline) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:step_index) }
    it { is_expected.to validate_numericality_of(:step_index).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:agent_type) }
    it { is_expected.to validate_presence_of(:config) }

    it "validates agent_type inclusion" do
      valid_types = %w[llm_agent browser_agent calendar_agent whatsapp_agent whatsapp_group_send memory_agent debug_agent]
      valid_types.each do |type|
        step = build(:pipeline_step, agent_type: type)
        expect(step).to be_valid
      end

      invalid_step = build(:pipeline_step, agent_type: "invalid_type")
      expect(invalid_step).not_to be_valid
    end

    it "validates step_index uniqueness scoped to pipeline_id" do
      pipeline = create(:pipeline)
      create(:pipeline_step, pipeline: pipeline, step_index: 0)

      duplicate_step = build(:pipeline_step, pipeline: pipeline, step_index: 0)
      expect(duplicate_step).not_to be_valid

      different_pipeline = create(:pipeline)
      valid_step = build(:pipeline_step, pipeline: different_pipeline, step_index: 0)
      expect(valid_step).to be_valid
    end
  end

  describe "scopes" do
    describe ".ordered" do
      it "returns records sorted by step_index" do
        pipeline = create(:pipeline)
        create(:pipeline_step, pipeline: pipeline, step_index: 2)
        create(:pipeline_step, pipeline: pipeline, step_index: 0)
        create(:pipeline_step, pipeline: pipeline, step_index: 1)

        expect(pipeline.pipeline_steps.ordered.pluck(:step_index)).to eq([0, 1, 2])
      end
    end
  end
end
