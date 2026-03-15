require "rails_helper"

RSpec.describe Triggers::SchedulerService do
  let(:pipeline) { create(:pipeline) }

  describe ".sync_all" do
    before do
      Sidekiq::Cron::Job.all.each { |job| Sidekiq::Cron::Job.destroy(job.name) }
    end

    it "registers enabled cron triggers with sidekiq-cron" do
      cron_trigger = create(:trigger, :cron, pipeline:, enabled: true, cron_expr: "0 * * * * *")
      Triggers::SchedulerService.sync_all

      job_name = "pipeline_trigger_#{cron_trigger.id}"
      job = Sidekiq::Cron::Job.find(job_name)
      expect(job).not_to be_nil
      expect(job.cron).to eq(cron_trigger.cron_expr)
      expect(job.klass).to eq("CronDispatcherJob")
      expect(job.args).to eq([cron_trigger.pipeline_id])
    end

    it "removes cron jobs that are no longer in DB" do
      cron_trigger1 = create(:trigger, :cron, pipeline:, enabled: true, cron_expr: "1 * * * * *")
      cron_trigger2 = create(:trigger, :cron, pipeline:, enabled: true, cron_expr: "2 * * * * *")

      Triggers::SchedulerService.sync_all

      job_name1 = "pipeline_trigger_#{cron_trigger1.id}"
      job_name2 = "pipeline_trigger_#{cron_trigger2.id}"

      job1 = Sidekiq::Cron::Job.find(job_name1)
      job2 = Sidekiq::Cron::Job.find(job_name2)

      expect(job1).not_to be_nil
      expect(job2).not_to be_nil
    end

    it "does nothing for non-cron triggers" do
      whatsapp_trigger = create(:trigger, :whatsapp, pipeline:, enabled: true)

      expect do
        Triggers::SchedulerService.sync_all
      end.not_to change { Sidekiq::Cron::Job.count }
    end
  end

  describe ".add" do
    before do
      Sidekiq::Cron::Job.all.each { |job| Sidekiq::Cron::Job.destroy(job.name) }
    end

    it "registers cron trigger with sidekiq-cron" do
      cron_trigger = create(:trigger, :cron, pipeline:, enabled: true, cron_expr: "0 * * * * *")
      Triggers::SchedulerService.add(cron_trigger)

      job_name = "pipeline_trigger_#{cron_trigger.id}"
      job = Sidekiq::Cron::Job.find(job_name)
      expect(job).not_to be_nil
      expect(job.cron).to eq(cron_trigger.cron_expr)
      expect(job.klass).to eq("CronDispatcherJob")
      expect(job.args).to eq([cron_trigger.pipeline_id])
    end

    it "does nothing for non-cron trigger" do
      whatsapp_trigger = create(:trigger, :whatsapp, pipeline:, enabled: true)

      expect do
        Triggers::SchedulerService.add(whatsapp_trigger)
      end.not_to change { Sidekiq::Cron::Job.count }
    end

    it "does nothing for disabled trigger" do
      disabled_trigger = create(:trigger, :cron, pipeline:, enabled: false, cron_expr: "0 * * * * *")

      expect do
        Triggers::SchedulerService.add(disabled_trigger)
      end.not_to change { Sidekiq::Cron::Job.count }
    end
  end

  describe ".remove" do
    before do
      Sidekiq::Cron::Job.all.each { |job| Sidekiq::Cron::Job.destroy(job.name) }
    end

    it "removes cron job from sidekiq-cron" do
      cron_trigger = create(:trigger, :cron, pipeline:, enabled: true, cron_expr: "0 * * * * *")
      Triggers::SchedulerService.add(cron_trigger)

      job_name = "pipeline_trigger_#{cron_trigger.id}"
      job = Sidekiq::Cron::Job.find(job_name)
      expect(job).not_to be_nil

      Triggers::SchedulerService.remove(cron_trigger.id)

      job = Sidekiq::Cron::Job.find(job_name)
      expect(job).to be_nil
    end
  end

  describe ".sync_trigger" do
    before do
      Sidekiq::Cron::Job.all.each { |job| Sidekiq::Cron::Job.destroy(job.name) }
    end

    it "registers enabled cron trigger" do
      cron_trigger = create(:trigger, :cron, pipeline:, enabled: true, cron_expr: "0 * * * * *")
      cron_trigger.update!(enabled: true)
      Triggers::SchedulerService.sync_trigger(cron_trigger)

      job_name = "pipeline_trigger_#{cron_trigger.id}"
      job = Sidekiq::Cron::Job.find(job_name)
      expect(job).not_to be_nil
      expect(job.cron).to eq(cron_trigger.cron_expr)
    end

    it "removes disabled cron trigger" do
      cron_trigger = create(:trigger, :cron, pipeline:, enabled: true, cron_expr: "0 * * * * *")
      cron_trigger.update!(enabled: false)
      Triggers::SchedulerService.sync_trigger(cron_trigger)

      job_name = "pipeline_trigger_#{cron_trigger.id}"
      job = Sidekiq::Cron::Job.find(job_name)
      expect(job).to be_nil
    end

    it "does nothing for non-cron trigger" do
      whatsapp_trigger = create(:trigger, :whatsapp, pipeline:, enabled: true)

      expect do
        Triggers::SchedulerService.sync_trigger(whatsapp_trigger)
      end.not_to change { Sidekiq::Cron::Job.count }
    end
  end
end
