"""Plugin protocol and field schema for pipeline agents."""

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class FieldSchema:
    name: str
    label: str
    placeholder: str = ""
    required: bool = True
    field_type: str = "text"  # "text" | "textarea" | "tel" | "select" | "combobox" | "group_select" | "calendar_select"
    options: list[str] = field(default_factory=list)  # used when field_type == "select" / "combobox"


@runtime_checkable
class AgentPlugin(Protocol):
    name: str
    label: str
    fields: list[FieldSchema]

    async def get_fields(self) -> list[FieldSchema]:
        """Return the list of configurable fields for this plugin.

        The default implementation returns the static ``fields`` class attribute.
        Plugins that need dynamic options (e.g. loaded from the DB) override this.
        """
        return self.fields

    async def run(self, config: dict[str, str], input: str) -> str:
        ...
