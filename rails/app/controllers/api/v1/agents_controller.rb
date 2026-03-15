class Api::V1::AgentsController < ApplicationController
  def schema
    render json: Integrations::AgentClient.new.schema
  rescue Integrations::AgentClient::Error => e
    render json: { error: e.message }, status: :bad_gateway
  end
end
