export interface Pipeline {
  id: string;
  name: string;
  pipeline_steps: PipelineStep[];
  created_at: string;
  updated_at: string;
}

export interface PipelineStep {
  id: number;
  pipeline_id: string;
  step_index: number;
  agent_type: string;
  config: Record<string, unknown>;
}

export interface Trigger {
  id: string;
  pipeline_id: string;
  pipeline_name?: string;
  trigger_type: "cron" | "whatsapp" | "wa_group";
  cron_expr: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export interface RunRecord {
  id: number;
  pipeline_id: string;
  pipeline_name: string;
  timestamp: string;
  status: "success" | "error" | "running";
  summary: string | null;
}

export interface Memory {
  id: string;
  label: string;
  max_memories: number;
  ttl_hours: number;
  max_value_size: number;
  created_at: string;
}

export interface MemoryEntry {
  id: number;
  memory_id: string;
  value: string;
  created_at: string;
}

export interface Calendar {
  id: string;
  label: string;
  calendar_id: string;
  credentials_file: string;
}

export interface WhatsAppGroup {
  jid: string;
  name: string;
  label: string;
}

export interface FieldSchema {
  name: string;
  label: string;
  field_type: "textarea" | "text" | "tel" | "combobox" | "select" | "group_select" | "calendar_select";
  placeholder: string;
  options: string[];
  required: boolean;
}

export interface AgentSchema {
  label: string;
  fields: FieldSchema[];
}

export type SchemaResponse = Record<string, AgentSchema>;
