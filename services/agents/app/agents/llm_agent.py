import anthropic
import httpx
from app.agents.base import BaseAgent
from app.config import config as app_config
from app.schema import AgentSchema, FieldSchema

ANTHROPIC_MODELS = [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
]


class LlmAgent(BaseAgent):
    SCHEMA = AgentSchema(
        label="LLM Agent",
        fields=[
            FieldSchema(
                name="provider",
                label="Provider",
                field_type="select",
                options=["anthropic", "ollama"],
                required=True,
            ),
            FieldSchema(
                name="model",
                label="Model",
                field_type="model_select",
                required=True,
            ),
            FieldSchema(
                name="prompt",
                label="Prompt",
                field_type="textarea",
                placeholder="Enter your prompt here. Use {input} to reference the pipeline input.",
                required=True,
            ),
            FieldSchema(
                name="system_prompt",
                label="System Prompt",
                field_type="textarea",
                placeholder="Optional system prompt",
                required=False,
            ),
        ],
    )

    def schema(self) -> dict:
        return self.SCHEMA.model_dump()

    def run(self, config: dict, input: str) -> str:
        provider = config.get("provider", "anthropic")
        model = config.get("model", "") or app_config.anthropic_model
        prompt = config.get("prompt", "").replace("{input}", input)
        system_prompt = config.get("system_prompt", "").replace("{input}", input)

        if provider == "ollama":
            return self._run_ollama(model, prompt, system_prompt)
        return self._run_anthropic(model, prompt, system_prompt)

    def _run_anthropic(self, model: str, prompt: str, system_prompt: str) -> str:
        client = anthropic.Anthropic(api_key=app_config.anthropic_api_key)
        kwargs = {
            "model": model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            kwargs["system"] = system_prompt
        message = client.messages.create(**kwargs)
        return message.content[0].text

    def _run_ollama(self, model: str, prompt: str, system_prompt: str) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        response = httpx.post(
            f"{app_config.ollama_base_url}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
            timeout=120,
        )
        response.raise_for_status()
        return response.json()["message"]["content"]
