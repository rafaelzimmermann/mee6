import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FieldRenderer } from "./FieldRenderer";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import type { SchemaResponse } from "../../api/types";

interface StepCardProps {
  id: string;
  stepIndex: number;
  agentType: string;
  config: Record<string, string>;
  schema: SchemaResponse;
  errors: Record<string, string>;
  onAgentTypeChange: (type: string) => void;
  onConfigChange: (field: string, value: string) => void;
  onConfigChangeMulti: (updates: Record<string, string>) => void;
  onRemove: () => void;
}

export function StepCard({
  id, stepIndex, agentType, config, schema, errors,
  onAgentTypeChange, onConfigChange, onConfigChangeMulti, onRemove,
}: StepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const agentOptions = Object.entries(schema).map(([key, agent]) => ({
    value: key,
    label: agent.label,
  }));

  const fields = agentType ? schema[agentType]?.fields ?? [] : [];

  return (
    <div ref={setNodeRef} style={style} className="step-card">
      <span {...attributes} {...listeners} className="drag-handle" aria-label="Drag to reorder">⠿</span>

      <span className="step-number">Step {stepIndex + 1}</span>

      <Select
        id={`agent-type-${id}`}
        label="Agent Type"
        value={agentType}
        onChange={(e) => onAgentTypeChange(e.target.value)}
        options={[{ value: "", label: "Select agent…" }, ...agentOptions]}
        error={errors.agent_type}
      />

      {fields.map((field) => (
        <FieldRenderer
          key={field.name}
          field={field}
          value={(config[field.name] as string) ?? ""}
          onChange={(val) => {
            if (field.name === "provider") {
              onConfigChangeMulti({ provider: val, model: "" });
            } else {
              onConfigChange(field.name, val);
            }
          }}
          error={errors[field.name]}
          stepConfig={config}
        />
      ))}

      <Button size="sm" variant="danger" onClick={onRemove}>
        Remove Step
      </Button>
    </div>
  );
}
