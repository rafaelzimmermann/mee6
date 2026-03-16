class Api::V1::AgentsController < ApplicationController
  # WhatsApp steps are executed by Rails, not the agents service,
  # so their schemas are defined here rather than in the Python service.
  RAILS_STEP_SCHEMAS = {
    "whatsapp_agent" => {
      label: "WhatsApp — Send DM",
      fields: [
        { name: "to", label: "Phone Number", field_type: "tel",
          placeholder: "+34612345678", options: [], required: true },
        { name: "message", label: "Message", field_type: "textarea",
          placeholder: "Leave blank to forward the previous step's output as-is.",
          options: [], required: false }
      ]
    },
    "whatsapp_group_send" => {
      label: "WhatsApp — Send to Group",
      fields: [
        { name: "group_jid", label: "Group", field_type: "group_select",
          placeholder: "", options: [], required: true },
        { name: "message", label: "Message", field_type: "textarea",
          placeholder: "Leave blank to forward the previous step's output as-is.",
          options: [], required: false }
      ]
    }
  }.freeze

  def schema
    agent_schemas = Integrations::AgentClient.new.schema
    render json: agent_schemas.merge(RAILS_STEP_SCHEMAS)
  rescue Integrations::AgentClient::Error
    render json: RAILS_STEP_SCHEMAS
  end

  def models
    provider = params[:provider].presence || "anthropic"
    render json: Integrations::AgentClient.new.models(provider: provider)
  rescue Integrations::AgentClient::Error
    render json: []
  end
end
