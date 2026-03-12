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

    async def run(self, config: dict[str, str], previous_output: str) -> str:
        from mee6.agents.browser_agent.agent import browse

        task = config.get("task", "").format_map({"previous_output": previous_output})
        return await browse(task)
