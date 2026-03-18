import base64
import json
import anthropic
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
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
        "description": "Click on an element by CSS selector. Use standard CSS selectors only — :contains() is NOT valid CSS. To click by visible text, use click_by_text instead.",
        "input_schema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "Standard CSS selector for the element (e.g. '#id', '.class', 'button[type=submit]')",
                },
            },
            "required": ["selector"],
        },
    },
    {
        "name": "click_by_text",
        "description": "Click the first element whose visible text matches the given string. Use this instead of click() when you want to target an element by its label or button text.",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The visible text of the element to click",
                },
                "exact": {
                    "type": "boolean",
                    "description": "If true, match the full text exactly. If false (default), match as a substring.",
                },
            },
            "required": ["text"],
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
        "name": "scroll",
        "description": "Scroll the page up or down by a number of pixels.",
        "input_schema": {
            "type": "object",
            "properties": {
                "direction": {
                    "type": "string",
                    "enum": ["up", "down"],
                    "description": "Direction to scroll",
                },
                "pixels": {
                    "type": "integer",
                    "description": "Number of pixels to scroll (default 500)",
                },
            },
            "required": ["direction"],
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
                name="provider",
                label="Provider",
                field_type="select",
                options=["anthropic"],
                required=True,
            ),
            FieldSchema(
                name="model",
                label="Model",
                field_type="model_select",
                required=True,
            ),
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
        model = config.get("model", "") or app_config.anthropic_model
        task = config.get("task", "").replace("{input}", input)
        start_url = config.get("start_url", "")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            if start_url:
                page.goto(start_url)

            result = self._tool_use_loop(page, task, model)
            browser.close()

        return result

    def _tool_use_loop(self, page, task: str, model: str) -> str:
        """Anthropic tool-use loop with browser actions."""
        client = anthropic.Anthropic(api_key=app_config.anthropic_api_key)
        messages = [{"role": "user", "content": task}]

        for iteration in range(20):
            response = client.messages.create(
                model=model,
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
                    if isinstance(result, dict) and result.get("__image__"):
                        content = [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": result["media_type"],
                                    "data": result["data"],
                                },
                            }
                        ]
                    else:
                        content = json.dumps(result)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": content,
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
            try:
                page.click(tool_input["selector"], timeout=5000)
            except PlaywrightTimeoutError:
                return {"error": f"Element not found: '{tool_input['selector']}'. If you are trying to click by text, use click_by_text instead."}
            return {"success": True, "action": "clicked"}

        elif tool_name == "click_by_text":
            try:
                exact = tool_input.get("exact", False)
                page.get_by_text(tool_input["text"], exact=exact).first.click(timeout=5000)
            except PlaywrightTimeoutError:
                return {"error": f"No element with text '{tool_input['text']}' found on the page."}
            return {"success": True, "action": "clicked"}

        elif tool_name == "type_text":
            page.fill(tool_input["selector"], tool_input["text"])
            return {"success": True, "typed": tool_input["text"]}

        elif tool_name == "get_text":
            text = page.inner_text(tool_input["selector"])
            return {"text": text[:20_000]}

        elif tool_name == "scroll":
            pixels = tool_input.get("pixels", 500)
            delta = pixels if tool_input["direction"] == "down" else -pixels
            page.mouse.wheel(0, delta)
            return {"success": True, "scrolled": tool_input["direction"], "pixels": pixels}

        elif tool_name == "screenshot":
            screenshot_bytes = page.screenshot()
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
            return {"__image__": True, "media_type": "image/png", "data": screenshot_b64}

        return {"error": f"Unknown tool '{tool_name}'. Available tools: navigate, click, click_by_text, type_text, get_text, scroll, screenshot."}
