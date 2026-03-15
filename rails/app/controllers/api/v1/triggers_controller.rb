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
        render json: TriggerBlueprint.render(trigger),
               status: :created
      end

      def update
        trigger.update!(trigger_params)
        render json: TriggerBlueprint.render(trigger)
      end

      def destroy
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
