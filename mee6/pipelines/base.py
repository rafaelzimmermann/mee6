"""Plugin protocol and field schema for pipeline agents."""

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class FieldSchema:
    name: str
    label: str
    placeholder: str = ""
    required: bool = True
    field_type: str = "text"  # "text" | "textarea" | "tel" | "select"
    options: list[str] = field(default_factory=list)  # used when field_type == "select"


@runtime_checkable
class AgentPlugin(Protocol):
    name: str
    label: str
    fields: list[FieldSchema]

    async def run(self, config: dict[str, str], previous_output: str) -> str:
        ...
