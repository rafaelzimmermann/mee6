require "rails_helper"

RSpec.describe "Webhooks::WhatsApp", type: :request do
  describe "POST /webhooks/whatsapp" do
    let!(:pipeline) { create(:pipeline) }
    let!(:trigger) { create(:trigger, :whatsapp, pipeline: pipeline, config: { phone: "+15550193456" }) }

    context "with valid secret and DM payload" do
      it "returns 200 and enqueues one PipelineJob per matching trigger" do
        ENV["WEBHOOK_SECRET"] = "test_secret"

        expect {
          post "/webhooks/whatsapp",
               params: { type: "dm", sender: "15550193456@s.whatsapp.net", text: "Hello" },
               headers: { "X-Webhook-Secret" => "test_secret" }
        }.to have_enqueued_job(PipelineJob).with(pipeline.id, "Hello").exactly(1).times

        expect(response).to have_http_status(:ok)
      end
    end

    context "with valid secret and group payload" do
      let!(:group_trigger) { create(:trigger, :wa_group, pipeline: pipeline, config: { group_jid: "1234567890@g.us" }) }

      it "returns 200 and enqueues job for matching group trigger" do
        ENV["WEBHOOK_SECRET"] = "test_secret"

        expect {
          post "/webhooks/whatsapp",
               params: { type: "group", chat_jid: "1234567890@g.us", text: "Hello group" },
               headers: { "X-Webhook-Secret" => "test_secret" }
        }.to have_enqueued_job(PipelineJob).with(pipeline.id, "Hello group").exactly(1).times

        expect(response).to have_http_status(:ok)
      end
    end

    context "with invalid secret" do
      it "returns 401 and enqueues no jobs" do
        ENV["WEBHOOK_SECRET"] = "correct_secret"

        expect {
          post "/webhooks/whatsapp",
               params: { type: "dm", sender: "15550193456@s.whatsapp.net", text: "Hello" },
               headers: { "X-Webhook-Secret" => "wrong_secret" }
        }.not_to have_enqueued_job(PipelineJob)

        expect(response).to have_http_status(:unauthorized)
        expect(JSON.parse(response.body)).to eq({ "error" => "Unauthorized" })
      end
    end

    context "with missing secret" do
      it "returns 401 and enqueues no jobs" do
        ENV["WEBHOOK_SECRET"] = "test_secret"

        expect {
          post "/webhooks/whatsapp",
               params: { type: "dm", sender: "15550193456@s.whatsapp.net", text: "Hello" }
        }.not_to have_enqueued_job(PipelineJob)

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with a phone that matches no enabled trigger" do
      it "returns 200 and enqueues no jobs" do
        ENV["WEBHOOK_SECRET"] = "test_secret"

        expect {
          post "/webhooks/whatsapp",
               params: { type: "dm", sender: "9999999999@s.whatsapp.net", text: "Hello" },
               headers: { "X-Webhook-Secret" => "test_secret" }
        }.not_to have_enqueued_job(PipelineJob)

        expect(response).to have_http_status(:ok)
      end
    end

    context "with a disabled trigger" do
      # Uses a distinct phone so the enabled let!(:trigger) above does not interfere.
      let!(:disabled_trigger) { create(:trigger, :whatsapp, :disabled, pipeline: pipeline, config: { phone: "+19998887777" }) }

      it "returns 200 and enqueues no jobs" do
        ENV["WEBHOOK_SECRET"] = "test_secret"

        expect {
          post "/webhooks/whatsapp",
               params: { type: "dm", sender: "19998887777@s.whatsapp.net", text: "Hello" },
               headers: { "X-Webhook-Secret" => "test_secret" }
        }.not_to have_enqueued_job(PipelineJob)

        expect(response).to have_http_status(:ok)
      end
    end

    context "with multiple matching triggers" do
      let!(:pipeline2) { create(:pipeline) }
      let!(:trigger2) { create(:trigger, :whatsapp, pipeline: pipeline2, config: { phone: "+15550193456" }) }

      it "enqueues one job per matching trigger" do
        ENV["WEBHOOK_SECRET"] = "test_secret"

        expect {
          post "/webhooks/whatsapp",
               params: { type: "dm", sender: "15550193456@s.whatsapp.net", text: "Hello" },
               headers: { "X-Webhook-Secret" => "test_secret" }
        }.to have_enqueued_job(PipelineJob).exactly(2).times

        expect(response).to have_http_status(:ok)
      end
    end
  end
end
