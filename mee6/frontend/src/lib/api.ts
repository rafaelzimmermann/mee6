const API_BASE = "/api/v1";

// Types
export interface Pipeline {
  id: string;
  name: string;
  steps: Step[];
}

export interface Step {
  agent_type: string;
  config: Record<string, string>;
}

export interface Agent {
  name: string;
  label: string;
}

export interface FieldSchema {
  name: string;
  label: string;
  field_type: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface PipelineCreateRequest {
  name: string;
  steps: Step[];
}

export interface PipelineCreateResponse {
  id: string;
  message: string;
}

// API Client
export const api = {
  // Pipelines
  pipelines: {
    list: async (): Promise<Pipeline[]> => {
      const response = await fetch(`${API_BASE}/pipelines`);
      if (!response.ok) {
        throw new Error(`Failed to fetch pipelines: ${response.statusText}`);
      }
      return response.json();
    },

    get: async (id: string): Promise<Pipeline> => {
      const response = await fetch(`${API_BASE}/pipelines/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch pipeline: ${response.statusText}`);
      }
      return response.json();
    },

    create: async (
      data: PipelineCreateRequest
    ): Promise<PipelineCreateResponse> => {
      const response = await fetch(`${API_BASE}/pipelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Failed to create pipeline: ${response.statusText}`);
      }
      return response.json();
    },

    update: async (id: string, data: PipelineCreateRequest): Promise<void> => {
      const response = await fetch(`${API_BASE}/pipelines/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Failed to update pipeline: ${response.statusText}`);
      }
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/pipelines/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Failed to delete pipeline: ${response.statusText}`);
      }
    },
  },

  // Agents
  agents: {
    list: async (): Promise<Agent[]> => {
      const response = await fetch(`${API_BASE}/agents`);
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
      }
      return response.json();
    },

    getAllFields: async (): Promise<Record<string, FieldSchema[]>> => {
      const response = await fetch(`${API_BASE}/agents/fields/batch`);
      if (!response.ok) {
        throw new Error(`Failed to fetch all agent fields: ${response.statusText}`);
      }
      return response.json();
    },

    getFields: async (type: string): Promise<FieldSchema[]> => {
      const response = await fetch(`${API_BASE}/agents/${type}/fields`);
      if (!response.ok) {
        throw new Error(`Failed to fetch agent fields: ${response.statusText}`);
      }
      return response.json();
    },
  },
};
