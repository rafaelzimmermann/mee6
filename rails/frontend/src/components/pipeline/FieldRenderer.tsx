import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { calendarsApi } from "../../api/integrations/calendars";
import { whatsappApi } from "../../api/integrations/whatsapp";
import { agentsApi } from "../../api/agents";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import type { FieldSchema } from "../../api/types";

interface FieldRendererProps {
  field: FieldSchema;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  stepConfig?: Record<string, string>;
}

const PLACEHOLDERS = [
  { text: "{input}",         hint: "Previous step's output" },
  { text: "{date}",          hint: "Current date & time (YYYY-MM-DD HH:MM)" },
  { text: "{memory:label}",  hint: "Memory contents — replace 'label' with your memory name" },
];

function PlaceholderChips() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-400">Placeholders:</span>
      {PLACEHOLDERS.map(({ text, hint }) => (
        <button
          key={text}
          type="button"
          title={hint}
          onClick={() => copy(text)}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-mono transition-colors ${
            copied === text
              ? "bg-green-50 border-green-300 text-green-700"
              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300 cursor-pointer"
          }`}
        >
          {text}
          <span className="font-sans text-gray-300">{copied === text ? "✓" : "⧉"}</span>
        </button>
      ))}
    </div>
  );
}

export function FieldRenderer({ field, value, onChange, error, stepConfig }: FieldRendererProps) {
  const { data: calendars } = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    enabled: field.field_type === "calendar_select",
  });

  const { data: groups } = useQuery({
    queryKey: ["whatsapp_groups"],
    queryFn: whatsappApi.groups,
    enabled: field.field_type === "group_select",
  });

  const provider = stepConfig?.provider ?? "anthropic";
  const { data: models } = useQuery({
    queryKey: ["agent_models", provider],
    queryFn: () => agentsApi.listModels(provider),
    enabled: field.field_type === "model_select",
    staleTime: 60_000,
  });

  const commonProps = {
    id: `field-${field.name}`,
    label: field.label,
    placeholder: field.placeholder,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(e.target.value),
    error,
  };

  switch (field.field_type) {
    case "textarea":
      return (
        <div>
          <Textarea {...commonProps} />
          <PlaceholderChips />
        </div>
      );

    case "text":
    case "tel":
      return (
        <div>
          <Input {...commonProps} type={field.field_type} />
          {field.field_type === "text" && <PlaceholderChips />}
        </div>
      );

    case "select":
      return (
        <Select
          {...commonProps}
          options={field.options.map((o) => ({ value: o, label: o }))}
        />
      );

    case "combobox":
      return (
        <>
          <Input
            {...commonProps}
            list={`datalist-${field.name}`}
          />
          <datalist id={`datalist-${field.name}`}>
            {field.options.map((o) => <option key={o} value={o} />)}
          </datalist>
        </>
      );

    case "calendar_select":
      return (
        <Select
          {...commonProps}
          options={(calendars ?? []).map((c) => ({ value: c.id, label: c.label }))}
        />
      );

    case "group_select":
      return (
        <Select
          {...commonProps}
          options={(groups ?? []).map((g) => ({
            value: g.jid,
            label: g.label || g.name,
          }))}
        />
      );

    case "model_select":
      return (
        <Select
          {...commonProps}
          options={[
            { value: "", label: "Select model…" },
            ...(models ?? []).map((m) => ({ value: m, label: m })),
          ]}
        />
      );

    default:
      return <Input {...commonProps} />;
  }
}
