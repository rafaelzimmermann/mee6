from mee6.pipelines.base import FieldSchema


class BrowserAgentPlugin:
    name = "browser_agent"
    label = "Browser Agent"
    fields = [
        FieldSchema(
            name="task",
            label="Task",
            placeholder="Go to https://example.com and extract…",
            field_type="textarea",
        )
    ]

    async def run(self, config: dict[str, str], input: str = "") -> str:
        from mee6.agents.browser_agent.agent import browse
        from mee6.pipelines.placeholders import resolve

        task = resolve(config.get("task", ""), input=input)
        return await browse(task)
