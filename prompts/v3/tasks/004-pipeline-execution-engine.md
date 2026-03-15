# Task 004 — Pipeline Execution Engine

## Goal

Implement the Rails-side execution stack that runs a pipeline end-to-end:
the `PipelineJob` ActiveJob, the `Pipelines::ExecutorService` step router,
the two Faraday HTTP clients (`Integrations::AgentClient` and
`Integrations::WhatsAppClient`), and the `Memories::AgentService` for the
native memory step. Every external HTTP call is stubbed in tests via WebMock.

---

## Prerequisites

- Task 002 complete: all models present.
- Task 003 complete: `TriggersController#run_now` exists and already calls
  `PipelineJob.perform_later`.

---

## Implementation steps

### 1. `Integrations::AgentClient`

`rails/app/services/integrations/agent_client.rb`

Faraday client that wraps the Python agent service (`AGENT_SERVICE_URL`).

```ruby
module Integrations
  class AgentClient
    class Error < StandardError; end
    class TimeoutError < Error; end
    class ServiceError < Error
      attr_reader :status, :body
      def initialize(status, body) = super("Agent service returned #{status}: #{body}")
    end

    # POST /run
    # payload: { agent_type:, config:, input: }
    # returns: parsed response body hash on success
    # raises:  ServiceError on non-2xx, TimeoutError on Faraday timeout
    def run(agent_type:, config:, input:)
      response = connection.post("/run") do |req|
        req.body = { agent_type:, config:, input: }.to_json
        req.headers["Content-Type"] = "application/json"
        req.headers["X-Service-Secret"] = secret
      end

      raise ServiceError.new(response.status, response.body) unless response.success?

      JSON.parse(response.body)
    rescue Faraday::TimeoutError => e
      raise TimeoutError, e.message
    end

    private

    def connection
      @connection ||= Faraday.new(url: base_url) do |f|
        f.options.timeout      = 60
        f.options.open_timeout = 5
        f.adapter Faraday.default_adapter
      end
    end

    def base_url = ENV.fetch("AGENT_SERVICE_URL")
    def secret   = ENV.fetch("AGENT_SERVICE_SECRET")
  end
end
```

---

### 2. `Integrations::WhatsAppClient`

`rails/app/services/integrations/whats_app_client.rb`

Faraday client for every endpoint on the WhatsApp service
(`WHATSAPP_SERVICE_URL`).

```ruby
module Integrations
  class WhatsAppClient
    class Error < StandardError; end
    class ServiceError < Error; end

    # POST /send
    # payload: { to:, text: }   (to is phone number or group JID)
    def send(to:, text:)
      post("/send", { to:, text: })
    end

    # GET /status
    # returns: { "status" => "connected"|..., "qr_svg" => nil|"..." }
    def status
      get("/status")
    end

    # GET /groups
    # returns: array of { "jid", "name" }
    def groups
      get("/groups")
    end

    # POST /monitor
    # payload: { callback_url:, phones: [], group_jids: [] }
    def monitor(callback_url:, phones: [], group_jids: [])
      post("/monitor", { callback_url:, phones:, group_jids: })
    end

    # POST /connect
    def connect
      post("/connect", {})
    end

    # POST /disconnect
    def disconnect
      post("/disconnect", {})
    end

    private

    def get(path)
      response = connection.get(path) { |r| auth_header(r) }
      raise ServiceError, "WhatsApp service error #{response.status}" unless response.success?
      JSON.parse(response.body)
    end

    def post(path, payload)
      response = connection.post(path) do |req|
        auth_header(req)
        req.headers["Content-Type"] = "application/json"
        req.body = payload.to_json
      end
      raise ServiceError, "WhatsApp service error #{response.status}" unless response.success?
      JSON.parse(response.body)
    end

    def auth_header(req)
      req.headers["X-Webhook-Secret"] = secret
    end

    def connection
      @connection ||= Faraday.new(url: base_url) do |f|
        f.options.timeout      = 30
        f.options.open_timeout = 5
        f.adapter Faraday.default_adapter
      end
    end

    def base_url = ENV.fetch("WHATSAPP_SERVICE_URL")
    def secret   = ENV.fetch("WHATSAPP_SERVICE_SECRET")
  end
end
```

---

### 3. `Memories::AgentService`

`rails/app/services/memories/agent_service.rb`

Native implementation — no HTTP call. Reads the `Memory` config identified by
`config[:memory_label]`, appends a new entry, and enforces `max_memories` and
TTL eviction. Returns the most recent entries as a string joined by newline
(the output that flows to the next step).

```ruby
module Memories
  class AgentService
    class MemoryNotFound < StandardError; end

    # config: { memory_label: "general", operation: "append"|"read" }
    # input:  string to store (when operation is "append")
    # returns: string of recent memory entries (newest first, within TTL)
    def call(config:, input:)
      memory = Memory.find_by!(label: config[:memory_label])

      if config[:operation] == "append"
        memory.memory_entries.create!(value: input.to_s.slice(0, memory.max_value_size))
        evict(memory)
      end

      memory.memory_entries
            .within_ttl(memory.ttl_hours)
            .recent
            .limit(memory.max_memories)
            .pluck(:value)
            .join("\n")
    rescue ActiveRecord::RecordNotFound
      raise MemoryNotFound, "No memory with label '#{config[:memory_label]}'"
    end

    private

    def evict(memory)
      # Delete entries beyond max_memories, oldest first
      excess_ids = memory.memory_entries
                         .order(created_at: :asc)
                         .offset(memory.max_memories)
                         .pluck(:id)
      MemoryEntry.where(id: excess_ids).delete_all if excess_ids.any?
    end
  end
end
```

---

### 4. `Pipelines::ExecutorService`

`rails/app/services/pipelines/executor_service.rb`

Iterates ordered steps, calls the correct backend, threads the output of one
step into the input of the next. Raises on the first failure.

```ruby
module Pipelines
  class ExecutorService
    Result = Struct.new(:output, :steps_log, keyword_init: true)

    # pipeline: Pipeline instance (with steps preloaded)
    # initial_input: string (from trigger message or manual run)
    # returns: Result
    # raises:  any error from sub-services (caller writes RunRecord)
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
        Memories::AgentService.new.call(config: step.config.symbolize_keys, input:)
      when "debug_agent"
        Rails.logger.debug("[DebugAgent] step=#{step.step_index} input=#{input.inspect}")
        input   # passthrough
      when "whatsapp_agent", "whatsapp_group_send"
        to = step.config["to"] || step.config["group_jid"]
        Integrations::WhatsAppClient.new.send(to:, text: input)
        input   # passthrough; send is a side-effect
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
```

---

### 5. `PipelineJob`

`rails/app/jobs/pipeline_job.rb`

Loads the pipeline, calls `ExecutorService`, writes a `RunRecord` on success
or error. Enforces a job-level timeout via `sidekiq_options`.

```ruby
class PipelineJob < ApplicationJob
  queue_as :default

  # Sidekiq-specific timeout (seconds). Adjust per deployment.
  sidekiq_options timeout: 300

  # pipeline_id: string
  # initial_input: string (default "")
  def perform(pipeline_id, initial_input = "")
    pipeline = Pipeline.includes(:pipeline_steps).find(pipeline_id)

    result = Pipelines::ExecutorService.new.call(
      pipeline:      pipeline,
      initial_input: initial_input
    )

    RunRecord.create!(
      pipeline_id:   pipeline.id,
      pipeline_name: pipeline.name,
      timestamp:     Time.current,
      status:        "success",
      summary:       result.output.to_s.truncate(2000)
    )
  rescue => e
    # Write a failure RunRecord even if the pipeline was not found
    name = pipeline&.name || pipeline_id
    RunRecord.create!(
      pipeline_id:   pipeline_id,
      pipeline_name: name,
      timestamp:     Time.current,
      status:        "error",
      summary:       "#{e.class}: #{e.message}".truncate(2000)
    )
    raise   # re-raise so Sidekiq marks the job as failed
  end
end
```

---

### 6. Service specs

#### `spec/services/integrations/agent_client_spec.rb`

Use WebMock to stub `POST #{ENV['AGENT_SERVICE_URL']}/run`.

Key cases:
- 200 response → returns parsed body hash
- 500 response → raises `Integrations::AgentClient::ServiceError`
- Faraday timeout → raises `Integrations::AgentClient::TimeoutError`

#### `spec/services/integrations/whats_app_client_spec.rb`

Stub `POST /send`, `GET /status`, `GET /groups`, `POST /monitor`.

Key cases:
- `#send` 200 → returns parsed body
- `#send` non-200 → raises `ServiceError`
- `#status` → returns hash with `"status"` key
- `#groups` → returns array

#### `spec/services/memories/agent_service_spec.rb`

Use real DB (no HTTP). Use FactoryBot factories.

Key cases:
- `operation: "append"` creates a `MemoryEntry`
- Max memories enforced: after inserting beyond `max_memories`, oldest entries
  are deleted
- TTL enforced: entries older than `ttl_hours` are excluded from output
- Unknown label raises `MemoryNotFound`

#### `spec/services/pipelines/executor_service_spec.rb`

Use WebMock + FactoryBot.

Key cases:
- `debug_agent` step passes input through unchanged
- `memory_agent` step delegates to `Memories::AgentService` (stub it)
- `llm_agent` step calls `AgentClient#run`; output becomes next step's input
- `whatsapp_agent` step calls `WhatsAppClient#send`; input passes through
- Error from `AgentClient` propagates out of `ExecutorService`

#### `spec/jobs/pipeline_job_spec.rb`

Key cases:
- Successful pipeline → `RunRecord` with `status: "success"` is created
- `ExecutorService` raises → `RunRecord` with `status: "error"` is created,
  and the exception is re-raised (so Sidekiq retries)
- Pipeline not found → `RunRecord` written with `status: "error"`

---

## File / class list

| Path | Description |
|---|---|
| `rails/app/services/integrations/agent_client.rb` | Faraday client for Python agent service POST /run |
| `rails/app/services/integrations/whats_app_client.rb` | Faraday client for all WhatsApp service endpoints |
| `rails/app/services/memories/agent_service.rb` | Native memory read/append with eviction |
| `rails/app/services/pipelines/executor_service.rb` | Step iterator and agent router |
| `rails/app/jobs/pipeline_job.rb` | ActiveJob: load pipeline, execute, write RunRecord |
| `rails/spec/services/integrations/agent_client_spec.rb` | AgentClient specs (WebMock) |
| `rails/spec/services/integrations/whats_app_client_spec.rb` | WhatsAppClient specs (WebMock) |
| `rails/spec/services/memories/agent_service_spec.rb` | MemoryAgentService specs (DB) |
| `rails/spec/services/pipelines/executor_service_spec.rb` | ExecutorService specs (WebMock + DB) |
| `rails/spec/jobs/pipeline_job_spec.rb` | PipelineJob specs |

---

## Acceptance criteria

- [ ] A pipeline with a single `debug_agent` step can be enqueued via
      `PipelineJob.perform_now(pipeline.id, "hello")` and produces a
      `RunRecord` with `status: "success"` and `summary: "hello"`
- [ ] A pipeline with an `llm_agent` step calls `POST /run` on the agent
      service (verified by WebMock assertion)
- [ ] A pipeline step failure writes a `RunRecord` with `status: "error"`
      and re-raises the exception
- [ ] `Memories::AgentService` evicts entries correctly (oldest dropped when
      over `max_memories`)
- [ ] `bundle exec rspec spec/services spec/jobs` passes with zero failures
