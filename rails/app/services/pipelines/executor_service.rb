module Pipelines
  class ExecutorService
    Result = Struct.new(:output, :steps_log, keyword_init: true)

    def call(pipeline:, initial_input: "")
      steps_log = []
      current_input = initial_input.to_s

      pipeline.pipeline_steps.ordered.each do |step|
        output = dispatch(step, current_input)
        steps_log << { step_index: step.step_index, agent_type: step.agent_type,
                       input: current_input, output: }
        current_input = output.to_s
      end

      Result.new(output: current_input, steps_log:)
    end

    private

    def dispatch(step, input)
      case step.agent_type
      when "memory_agent"
        Memories::MemoryService.new.store(step.config["memory_label"], input)
        input
      when "debug_agent"
        Rails.logger.debug("[DebugAgent] step=#{step.step_index} input=#{input.inspect}")
        input
      when "whatsapp_agent", "whatsapp_group_send"
        to   = step.config["to"] || step.config["group_jid"]
        text = step.config["message"].present? \
                 ? step.config["message"].gsub("{input}", input) \
                 : input
        Integrations::WhatsAppClient.new.send(to:, text:)
        input
      else
        result = Integrations::AgentClient.new.run(
          agent_type: step.agent_type,
          config:     resolve_placeholders(step.config, input),
          input:
        )
        result["output"].to_s
      end
    end

    def resolve_placeholders(config, input)
      memory_svc = Memories::MemoryService.new
      config.transform_values do |v|
        next v unless v.is_a?(String)
        v = v.gsub(/\{memory:([^}]+)\}/) { memory_svc.read($1).join("\n") }
        v = v.gsub("{date}", Time.current.strftime("%Y-%m-%d %H:%M"))
        v
      end
    end
  end
end
