"""Tests for placeholder resolution in mee6.pipelines.placeholders."""

from unittest.mock import AsyncMock, patch

import pytest

from mee6.pipelines.placeholders import resolve, resolve_with_memory


# ---------------------------------------------------------------------------
# resolve() — synchronous placeholders
# ---------------------------------------------------------------------------


def test_resolve_input():
    assert resolve("{input}", input="hello") == "hello"


def test_resolve_previous_output_alias():
    assert resolve("{previous_output}", input="hi") == "hi"


def test_resolve_date_format():
    result = resolve("{date}")
    import re
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", result)


def test_resolve_now_format():
    result = resolve("{now}")
    import re
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00", result)


def test_resolve_memory_placeholder_preserved():
    """resolve() must leave {memory:label} intact for resolve_with_memory()."""
    result = resolve("context: {memory:notes}", input="x")
    assert result == "context: {memory:notes}"


def test_resolve_memory_placeholder_does_not_raise():
    """resolve() must not raise KeyError for {memory:label}."""
    resolve("{memory:any_label}")


def test_resolve_memory_and_input_together():
    result = resolve("msgs: {memory:inbox} — reply: {input}", input="ok")
    assert result == "msgs: {memory:inbox} — reply: ok"


def test_resolve_multiple_memory_placeholders():
    result = resolve("{memory:a} and {memory:b}")
    assert result == "{memory:a} and {memory:b}"


# ---------------------------------------------------------------------------
# resolve_with_memory() — async memory expansion
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resolve_with_memory_expands_label():
    with patch(
        "mee6.pipelines.placeholders.get_memories_for_label",
        new=AsyncMock(return_value="[Memory: notes]\n[1] 2026-01-01 — entry1"),
    ) as mock:
        result = await resolve_with_memory("ctx: {memory:notes}", input="")

    assert "[Memory: notes]" in result
    assert "entry1" in result
    mock.assert_awaited_once_with("notes")


@pytest.mark.asyncio
async def test_resolve_with_memory_expands_multiple_labels():
    async def _fake(label: str) -> str:
        return f"[Memory: {label}]"

    with patch("mee6.pipelines.placeholders.get_memories_for_label", side_effect=_fake):
        result = await resolve_with_memory("{memory:a} | {memory:b}")

    assert result == "[Memory: a] | [Memory: b]"


@pytest.mark.asyncio
async def test_resolve_with_memory_also_expands_input():
    with patch(
        "mee6.pipelines.placeholders.get_memories_for_label",
        new=AsyncMock(return_value="memories"),
    ):
        result = await resolve_with_memory("{input} and {memory:x}", input="DATA")

    assert result == "DATA and memories"


@pytest.mark.asyncio
async def test_resolve_with_memory_no_memory_placeholder():
    """Text without {memory:...} passes through without calling get_memories_for_label."""
    with patch(
        "mee6.pipelines.placeholders.get_memories_for_label",
        new=AsyncMock(),
    ) as mock:
        result = await resolve_with_memory("hello {input}", input="world")

    assert result == "hello world"
    mock.assert_not_awaited()
