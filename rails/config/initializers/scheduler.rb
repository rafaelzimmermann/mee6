if defined?(Sidekiq) && !Rails.env.test?
  Rails.application.config.after_initialize do
    Triggers::SchedulerService.sync_all
  rescue => e
    Rails.logger.error("[SchedulerService] sync_all failed on boot: #{e.message}")
  end
end
