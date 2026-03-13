"""browser-use agent wrapper for mee6."""

import glob
import logging
import os
import time
from pathlib import Path

from browser_use import Agent, BrowserProfile

from mee6.config import settings

logger = logging.getLogger(__name__)


def _find_headless_shell() -> str | None:
    """Find the Playwright-managed chromium-headless-shell binary.

    browser-use's LocalBrowserWatchdog globs for 'chromium-*/chrome-linux*/chrome'
    which finds the full Chrome binary that crashes in Docker.  Playwright actually
    uses the headless-shell binary which lives at a different path.
    """
    pw_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "~/.cache/ms-playwright")
    pattern = str(
        Path(pw_path).expanduser()
        / "chromium_headless_shell-*"
        / "chrome-*"
        / "chrome-headless-shell"
    )
    matches = sorted(glob.glob(pattern))
    return matches[-1] if matches else None


def _build_llm(provider: str, model: str):
    if provider == "ollama":
        from browser_use.llm.ollama.chat import ChatOllama

        return ChatOllama(model=model or settings.ollama_default_model, base_url=settings.ollama_base_url)
    else:
        from browser_use.llm.anthropic.chat import ChatAnthropic

        return ChatAnthropic(model=model or settings.anthropic_model, api_key=settings.anthropic_api_key)


async def browse(task: str, provider: str = "anthropic", model: str = "") -> str:
    """Run a browser-use agent with the given task and return the final result string."""
    llm = _build_llm(provider, model)

    headless_shell = _find_headless_shell()
    if headless_shell:
        logger.info("browser_agent: using headless-shell at %s", headless_shell)
        browser_profile = BrowserProfile(executable_path=headless_shell)
    else:
        logger.warning("browser_agent: headless-shell not found, using default browser detection")
        browser_profile = None

    logger.info("browser_agent: creating Agent with provider=%s model=%s", provider, model or "(default)")
    _t0 = time.monotonic()
    agent = Agent(task=task, llm=llm, browser_profile=browser_profile)
    logger.info("browser_agent: Agent() took %.2fs", time.monotonic() - _t0)
    logger.info("browser_agent: calling agent.run()")
    history = await agent.run()
    logger.info("browser_agent: agent.run() returned; final_result=%r", history.final_result())
    return history.final_result() or ""
