from mee6.pipelines.base import FieldSchema


class LlmAgentPlugin:
    name = "llm_agent"
    label = "LLM Agent"
    fields = [
        FieldSchema(
            name="provider",
            label="Provider",
            field_type="combobox",
            placeholder="anthropic",
            options=["anthropic", "ollama"],
            required=True,
        ),
        FieldSchema(
            name="model",
            label="Model (leave blank for default)",
            placeholder="claude-sonnet-4-6",
            field_type="combobox",
            required=False,
            options=[
                "claude-sonnet-4-6",
                "claude-haiku-4-5-20251001",
                "claude-opus-4-6",
                "llama3.2",
                "llama3.1",
                "mistral",
                "gemma2",
            ],
        ),
        FieldSchema(
            name="prompt",
            label="Prompt",
            placeholder="Summarise the following: {previous_output}",
            field_type="textarea",
            required=True,
        ),
    ]

    async def run(self, config: dict[str, str], previous_output: str) -> str:
        from mee6.agents.llm_agent.agent import llm_call

        return await llm_call(
            prompt=config.get("prompt", ""),
            previous_output=previous_output,
            provider=config.get("provider", "anthropic"),
            model=config.get("model", ""),
        )
