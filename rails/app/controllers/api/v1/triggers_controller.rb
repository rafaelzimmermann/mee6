module Api
  module V1
    class TriggersController < BaseController
      def index
        triggers = params[:pipeline_id] ? Trigger.where(pipeline_id: params[:pipeline_id])
                                   : Trigger.all
        render json: TriggerBlueprint.render(triggers)
      end

      def create
        trigger = Trigger.new(trigger_params)
        trigger.save!
        Triggers::SchedulerService.add(trigger)
        render json: TriggerBlueprint.render(trigger),
               status: :created
      end

      def update
        trigger.assign_attributes(trigger_params)
        trigger.save!
        Triggers::SchedulerService.sync_trigger(trigger)
        render json: TriggerBlueprint.render(trigger)
      end

      def destroy
        Triggers::SchedulerService.remove(trigger.id)
        trigger.destroy!
        head :no_content
      end

      def run_now
        PipelineJob.perform_later(trigger.pipeline_id)
        render json: { ok: true }
      end

      def toggle
        trigger.update!(enabled: !trigger.enabled)
        render json: TriggerBlueprint.render(trigger)
      end

      private

      def trigger
        @trigger ||= Trigger.find(params[:id])
      end

      def trigger_params
        params.require(:trigger).permit(:pipeline_id, :trigger_type, :cron_expr,
                                  :enabled, config: {})
      end
    end
  end
end
