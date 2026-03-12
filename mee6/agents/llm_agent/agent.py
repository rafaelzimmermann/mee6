"""Thin LLM wrapper: call Anthropic or Ollama with a prompt and return the text."""

import logging

from mee6.config import settings

logger = logging.getLogger(__name__)


async def llm_call(
    prompt: str,
    previous_output: str = "",
    provider: str = "anthropic",
    model: str = "",
) -> str:
    """Call an LLM and return the text response.

    If *previous_output* is non-empty and the caller didn't embed
    ``{previous_output}`` in *prompt*, the previous output is prepended as
    context so the LLM can see it without requiring the user to explicitly
    reference it in the template.
    """
    # Build the final prompt.
    if "{previous_output}" in prompt:
        final_prompt = prompt.format_map({"previous_output": previous_output})
    elif previous_output:
        # Auto-inject: previous step's output as context, prompt as instruction.
        final_prompt = f"{previous_output}\n\n{prompt}" if prompt else previous_output
    else:
        final_prompt = prompt

    logger.info("llm_agent: provider=%s model=%s prompt_len=%d", provider, model or "(default)", len(final_prompt))

    if provider == "ollama":
        return await _call_ollama(final_prompt, model or settings.ollama_default_model)
    else:
        return await _call_anthropic(final_prompt, model or settings.anthropic_model)


async def _call_anthropic(prompt: str, model: str) -> str:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text  # type: ignore[union-attr]


async def _call_ollama(prompt: str, model: str) -> str:
    import httpx

    url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json={"model": model, "prompt": prompt, "stream": False})
        resp.raise_for_status()
        return resp.json()["response"]
