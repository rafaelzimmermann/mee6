module Api
  module V1
    class RunRecordsController < BaseController
      def index
        records = RunRecord.recent
        records = records.for_pipeline(params[:pipeline_id]) if params[:pipeline_id]
        render json: RunRecordBlueprint.render(records)
      end
    end
  end
end
