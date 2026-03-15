require "rails_helper"

RSpec.describe Triggers::DispatchService do
  let(:pipeline) { create(:pipeline) }
  let(:service) { described_class.new }

  describe "#call" do
    context "with DM type and matching phone" do
      it "enqueues one job with correct initial_input" do
        trigger = create(:trigger, :whatsapp, pipeline:, config: { phone: "+15550193456" })

        expect {
          service.call(type: "dm", sender: "15550193456@s.whatsapp.net", text: "Hello world")
        }.to have_enqueued_job(PipelineJob).with(pipeline.id, "Hello world").exactly(1).times
      end
    end

    context "with DM type and non-matching phone" do
      it "enqueues no jobs" do
        trigger = create(:trigger, :whatsapp, pipeline:, config: { phone: "+15550193456" })

        expect {
          service.call(type: "dm", sender: "9999999999@s.whatsapp.net", text: "Hello world")
        }.not_to have_enqueued_job(PipelineJob)
      end
    end

    context "with group type and matching JID" do
      it "enqueues job" do
        trigger = create(:trigger, :wa_group, pipeline:, config: { group_jid: "1234567890@g.us" })

        expect {
          service.call(type: "group", chat_jid: "1234567890@g.us", text: "Hello group")
        }.to have_enqueued_job(PipelineJob).with(pipeline.id, "Hello group").exactly(1).times
      end
    end

    context "with group type and non-matching JID" do
      it "enqueues no jobs" do
        trigger = create(:trigger, :wa_group, pipeline:, config: { group_jid: "1234567890@g.us" })

        expect {
          service.call(type: "group", chat_jid: "9999999999@g.us", text: "Hello group")
        }.not_to have_enqueued_job(PipelineJob)
      end
    end

    context "with disabled trigger" do
      it "does not match even if phone matches" do
        trigger = create(:trigger, :whatsapp, :disabled, pipeline:, config: { phone: "+15550193456" })

        expect {
          service.call(type: "dm", sender: "15550193456@s.whatsapp.net", text: "Hello world")
        }.not_to have_enqueued_job(PipelineJob)
      end
    end

    context "with multiple matching triggers" do
      it "enqueues one job per trigger" do
        pipeline2 = create(:pipeline)
        trigger1 = create(:trigger, :whatsapp, pipeline:, config: { phone: "+15550193456" })
        trigger2 = create(:trigger, :whatsapp, pipeline: pipeline2, config: { phone: "+15550193456" })

        expect {
          service.call(type: "dm", sender: "15550193456@s.whatsapp.net", text: "Hello world")
        }.to have_enqueued_job(PipelineJob).exactly(2).times
      end
    end

    context "with phone number in different formats" do
      it "matches when phone has various formats" do
        trigger = create(:trigger, :whatsapp, pipeline:, config: { phone: "15550193456" })

        expect {
          service.call(type: "dm", sender: "+15550193456@s.whatsapp.net", text: "Hello")
        }.to have_enqueued_job(PipelineJob).exactly(1).times
      end
    end
  end
end
