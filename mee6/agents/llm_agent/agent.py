"""Thin LLM wrapper: call Anthropic or Ollama with a prompt and return the text."""

import logging

from mee6.config import settings

logger = logging.getLogger(__name__)


async def llm_call(
    prompt: str,
    input: str = "",
    provider: str = "anthropic",
    model: str = "",
) -> str:
    """Call an LLM and return the text response.

    If *input* is non-empty and the caller didn't embed ``{input}`` (or
    ``{previous_output}``) in *prompt*, the input is prepended as context.
    """
    from mee6.pipelines.placeholders import resolve_with_memory

    has_placeholder = "{input}" in prompt or "{previous_output}" in prompt or "{memory:" in prompt
    if has_placeholder:
        final_prompt = await resolve_with_memory(prompt, input=input)
    elif input:
        # Auto-inject: previous step's output as context, prompt as instruction.
        final_prompt = f"{input}\n\n{prompt}" if prompt else input
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
        max_tokens=settings.anthropic_max_tokens,
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
