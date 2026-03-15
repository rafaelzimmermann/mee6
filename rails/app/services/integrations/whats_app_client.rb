module Integrations
  class WhatsAppClient
    class Error < StandardError; end
    class ServiceError < Error; end

    def send(to:, text:)
      post("/send", { to:, text: })
    end

    def status
      get("/status")
    end

    def groups
      get("/groups")
    end

    def monitor(callback_url:, phones: [], group_jids: [])
      post("/monitor", { callback_url:, phones:, group_jids: })
    end

    def connect
      post("/connect", {})
    end

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
