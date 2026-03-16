module Integrations
  class AgentClient
    class Error < StandardError; end
    class TimeoutError < Error; end
    class ServiceError < Error
      attr_reader :status, :body
      def initialize(status, body) = super("Agent service returned #{status}: #{body}")
    end

    def schema
      response = connection.get("/schema")
      raise ServiceError.new(response.status, response.body) unless response.success?
      JSON.parse(response.body)
    rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
      raise TimeoutError, e.message
    end

    def run(agent_type:, config:, input:)
      response = connection.post("/run") do |req|
        req.body = { agent_type:, config:, input: }.to_json
        req.headers["Content-Type"] = "application/json"
        req.headers["Authorization"] = "Bearer #{secret}"
      end

      raise ServiceError.new(response.status, response.body) unless response.success?

      JSON.parse(response.body)
    rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
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
