"""browser-use agent wrapper for mee6."""

from browser_use import Agent
from langchain_anthropic import ChatAnthropic

from mee6.config import settings


async def browse(task: str) -> str:
    """Run a browser-use agent with the given task and return the final result string."""
    llm = ChatAnthropic(
        model=settings.anthropic_model,
        api_key=settings.anthropic_api_key,
    )
    agent = Agent(task=task, llm=llm)
    history = await agent.run()
    return history.final_result() or ""
