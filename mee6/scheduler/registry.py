"""Maps agent name strings to their task coroutine functions.

Add new agents here as they are created.
"""

from typing import Any, Callable, Coroutine

from mee6.tasks.school_events import run_school_monitor

TASK_REGISTRY: dict[str, Callable[[], Coroutine[Any, Any, dict]]] = {
    "school-monitor": run_school_monitor,
}
