module Triggers
  class SchedulerService
    JOB_CLASS = "CronDispatcherJob"

    def self.sync_all
      db_triggers = Trigger.enabled.cron_type.to_a

      desired = db_triggers.index_by { |t| cron_job_name(t.id) }

      Sidekiq::Cron::Job.all.each do |job|
        Sidekiq::Cron::Job.destroy(job.name) unless desired.key?(job.name)
      end

      db_triggers.each { |t| upsert(t) }
    end

    def self.add(trigger)
      return unless trigger.cron?
      return unless trigger.enabled?

      upsert(trigger)
    end

    def self.remove(trigger_id)
      Sidekiq::Cron::Job.destroy(cron_job_name(trigger_id))
    end

    def self.sync_trigger(trigger)
      return unless trigger.cron?

      if trigger.enabled?
        upsert(trigger)
      else
        remove(trigger.id)
      end
    end

    private

    def self.cron_job_name(trigger_id)
      "pipeline_trigger_#{trigger_id}"
    end

    def self.upsert(trigger)
      Sidekiq::Cron::Job.create(
        name: cron_job_name(trigger.id),
        cron: trigger.cron_expr,
        class: JOB_CLASS,
        args: [trigger.pipeline_id]
      )
    end
  end
end
