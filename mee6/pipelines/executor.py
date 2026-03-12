"""Runs a pipeline by executing each step in order, chaining outputs."""

import logging

from mee6.pipelines.models import Pipeline
from mee6.pipelines.plugin_registry import AGENT_PLUGINS

logger = logging.getLogger(__name__)


async def run_pipeline(pipeline: Pipeline) -> dict:
    output = ""
    for i, step in enumerate(pipeline.steps):
        plugin = AGENT_PLUGINS.get(step.agent_type)
        if plugin is None:
            raise ValueError(f"Step {i}: unknown agent type {step.agent_type!r}")
        logger.info("pipeline %r: running step %d (%s)", pipeline.name, i, step.agent_type)
        output = await plugin.run(step.config, previous_output=output)
    return {
        "summary": f"{len(pipeline.steps)} step(s) completed",
        "final_output": output,
    }
