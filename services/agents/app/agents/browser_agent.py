import base64
import json
import anthropic
from playwright.sync_api import sync_playwright
from app.agents.base import BaseAgent
from app.config import config as app_config
from app.schema import AgentSchema, FieldSchema


BROWSER_TOOLS = [
    {
        "name": "navigate",
        "description": "Navigate to a URL in the browser.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The URL to navigate to"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "click",
        "description": "Click on an element on the page.",
        "input_schema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS selector for the element",
                },
            },
            "required": ["selector"],
        },
    },
    {
        "name": "type_text",
        "description": "Type text into an input field.",
        "input_schema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS selector for the input field",
                },
                "text": {"type": "string", "description": "The text to type"},
            },
            "required": ["selector", "text"],
        },
    },
    {
        "name": "get_text",
        "description": "Get the text content of an element.",
        "input_schema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS selector for the element",
                },
            },
            "required": ["selector"],
        },
    },
    {
        "name": "screenshot",
        "description": "Take a screenshot of the current page.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
]


class BrowserAgent(BaseAgent):
    SCHEMA = AgentSchema(
        label="Browser Agent",
        fields=[
            FieldSchema(
                name="task",
                label="Task",
                field_type="textarea",
                placeholder="Describe what to do in the browser. Use {input} for dynamic input.",
                required=True,
            ),
            FieldSchema(
                name="start_url",
                label="Start URL",
                field_type="text",
                placeholder="https://example.com",
                required=False,
            ),
        ],
    )

    def schema(self) -> dict:
        return self.SCHEMA.model_dump()

    def run(self, config: dict, input: str) -> str:
        task = config.get("task", "").replace("{input}", input)
        start_url = config.get("start_url", "")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            if start_url:
                page.goto(start_url)

            result = self._tool_use_loop(page, task)
            browser.close()

        return result

    def _tool_use_loop(self, page, task: str) -> str:
        """Anthropic tool-use loop with browser actions."""
        client = anthropic.Anthropic(api_key=app_config.anthropic_api_key)
        messages = [{"role": "user", "content": task}]

        for iteration in range(20):
            response = client.messages.create(
                model=app_config.anthropic_model,
                max_tokens=4096,
                tools=BROWSER_TOOLS,
                messages=messages,
            )

            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                return ""

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = self._execute_tool(page, block.name, block.input)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result),
                        }
                    )

            if tool_results:
                messages.append({"role": "user", "content": tool_results})

        return "Max iterations reached without a final response."

    def _execute_tool(self, page, tool_name: str, tool_input: dict):
        if tool_name == "navigate":
            page.goto(tool_input["url"])
            return {"success": True, "url": tool_input["url"]}

        elif tool_name == "click":
            page.click(tool_input["selector"])
            return {"success": True, "action": "clicked"}

        elif tool_name == "type_text":
            page.fill(tool_input["selector"], tool_input["text"])
            return {"success": True, "typed": tool_input["text"]}

        elif tool_name == "get_text":
            text = page.inner_text(tool_input["selector"])
            return {"text": text}

        elif tool_name == "screenshot":
            screenshot_bytes = page.screenshot()
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
            return {
                "image": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": screenshot_b64,
                }
            }

        raise ValueError(f"Unknown tool: {tool_name}")
