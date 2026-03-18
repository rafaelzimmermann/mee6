module Api
  module V1
    class PipelinesController < BaseController
      def index
        render json: PipelineBlueprint.render(Pipeline.ordered.includes(:pipeline_steps), view: :with_steps)
      end

      def show
        render json: PipelineBlueprint.render(pipeline, view: :with_steps)
      end

      def create
        pipeline = Pipeline.new(pipeline_params_without_steps)
        ActiveRecord::Base.transaction do
          replace_steps(pipeline, steps_params)
          pipeline.save!
        end
        render json: PipelineBlueprint.render(pipeline, view: :with_steps),
               status: :created
      end

      def update
        ActiveRecord::Base.transaction do
          pipeline.assign_attributes(pipeline_params_without_steps)
          replace_steps(pipeline, steps_params) if params[:pipeline]&.key?(:pipeline_steps_attributes)
          pipeline.save!
        end
        render json: PipelineBlueprint.render(pipeline, view: :with_steps)
      end

      def destroy
        pipeline.destroy!
        head :no_content
      end

      def run_now
        PipelineJob.perform_later(pipeline.id)
        render json: { ok: true }
      end

      private

      def pipeline
        @pipeline ||= Pipeline.find(params[:id])
      end

      def pipeline_params_without_steps
        params.require(:pipeline).permit(:id, :name)
      end

      def steps_params
        params[:pipeline][:pipeline_steps_attributes]&.map do |s|
          s.permit(:step_index, :agent_type, config: {})
        end || []
      end

      def replace_steps(pipeline, steps_attrs)
        pipeline.pipeline_steps.destroy_all
        steps_attrs.each_with_index do |attrs, idx|
          pipeline.pipeline_steps.build(attrs.merge(step_index: attrs[:step_index] || idx))
        end
      end
    end
  end
end
