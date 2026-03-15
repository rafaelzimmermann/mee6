import { useQuery } from "@tanstack/react-query";
import { calendarsApi } from "../../api/integrations/calendars";
import { whatsappApi } from "../../api/integrations/whatsapp";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import type { FieldSchema } from "../../api/types";

interface FieldRendererProps {
  field: FieldSchema;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
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

  const commonProps = {
    id: `field-${field.name}`,
    label: field.label,
    placeholder: field.placeholder,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(e.target.value),
    error,
  };

  const placeholderHint = (
    <p className="mt-1 text-xs text-gray-400">
      Use <code className="bg-gray-100 px-1 rounded">{"{input}"}</code> to insert the previous step&apos;s output.
    </p>
  );

  switch (field.field_type) {
    case "textarea":
      return (
        <div>
          <Textarea {...commonProps} />
          {placeholderHint}
        </div>
      );

    case "text":
    case "tel":
      return (
        <div>
          <Input {...commonProps} type={field.field_type} />
          {field.field_type === "text" && placeholderHint}
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

    default:
      return <Input {...commonProps} />;
  }
}
