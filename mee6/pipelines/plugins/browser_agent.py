from mee6.pipelines.base import AgentPlugin, FieldSchema


class BrowserAgentPlugin(AgentPlugin):
    name = "browser_agent"
    label = "Browser Agent"
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
                "phi4:14b",
                "llama3.2",
                "mistral",
            ],
        ),
        FieldSchema(
            name="task",
            label="Task",
            placeholder="Go to https://example.com and extract…",
            field_type="textarea",
        ),
    ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        from mee6.agents.browser_agent.agent import browse
        from mee6.pipelines.placeholders import resolve_with_memory

        task = await resolve_with_memory(config.get("task", ""), input=input)
        return await browse(
            task,
            provider=config.get("provider", "anthropic"),
            model=config.get("model", ""),
        )
