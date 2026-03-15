from typing import Literal
from pydantic import BaseModel


FieldType = Literal[
    "textarea", "text", "tel", "combobox", "select", "group_select", "calendar_select"
]


class FieldSchema(BaseModel):
    name: str
    label: str
    field_type: FieldType
    placeholder: str = ""
    options: list[str] = []
    required: bool = True


class AgentSchema(BaseModel):
    label: str
    fields: list[FieldSchema]
