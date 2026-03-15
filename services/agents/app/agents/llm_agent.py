import anthropic
from app.agents.base import BaseAgent
from app.config import config as app_config
from app.schema import AgentSchema, FieldSchema


class LlmAgent(BaseAgent):
    SCHEMA = AgentSchema(
        label="LLM Agent",
        fields=[
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
        prompt = config.get("prompt", "")
        system_prompt = config.get("system_prompt", "")

        resolved_prompt = prompt.replace("{input}", input)
        resolved_system_prompt = system_prompt.replace("{input}", input)

        client = anthropic.Anthropic(api_key=app_config.anthropic_api_key)

        kwargs = {
            "model": app_config.anthropic_model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": resolved_prompt}],
        }
        if resolved_system_prompt:
            kwargs["system"] = resolved_system_prompt

        message = client.messages.create(**kwargs)
        return message.content[0].text
