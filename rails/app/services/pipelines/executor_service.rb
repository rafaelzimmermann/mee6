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
        svc   = Memories::AgentService.new
        label = step.config["memory_label"]
        svc.store(label, input) if step.config["operation"] == "append"
        svc.read(label).join("\n")
      when "debug_agent"
        Rails.logger.debug("[DebugAgent] step=#{step.step_index} input=#{input.inspect}")
        input
      when "whatsapp_agent", "whatsapp_group_send"
        to = step.config["to"] || step.config["group_jid"]
        Integrations::WhatsAppClient.new.send(to:, text: input)
        input
      else
        result = Integrations::AgentClient.new.run(
          agent_type: step.agent_type,
          config:     step.config,
          input:
        )
        result["output"].to_s
      end
    end
  end
end
