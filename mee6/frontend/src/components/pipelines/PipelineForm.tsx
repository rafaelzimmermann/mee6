import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePipeline, useUpdatePipeline, useCreatePipeline } from "@/hooks/usePipelines";
import { useAgents, useAgentFields } from "@/hooks/useAgents";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Layout } from "@/components/common/Layout";
import { Trash2, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { pipelineSchema, type PipelineInput } from "@/lib/validation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldSchema } from "@/lib/api";

interface Step {
  id: string;
  agent_type: string;
  config: Record<string, string>;
}

interface AgentFieldsProps {
  agentType: string;
  config: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

function AgentFields({ agentType, config, onChange }: AgentFieldsProps) {
  const { data: fields, isLoading } = useAgentFields(agentType);

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading fields...</div>;
  }

  if (!fields || fields.length === 0) {
    return <div className="text-sm text-gray-500">No fields configured for this agent.</div>;
  }

  return (
    <div className="space-y-3">
      {fields.map((field: FieldSchema) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {renderField(field, config, onChange)}
        </div>
      ))}
    </div>
  );
}

function renderField(
  field: FieldSchema,
  config: Record<string, string>,
  onChange: (field: string, value: string) => void
) {
  const value = config[field.name] || "";

  switch (field.field_type) {
    case "textarea":
      return (
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={field.placeholder || ""}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          rows={3}
        />
      );

    case "select":
      return (
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
        >
          <option value="">— select —</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case "checkbox":
      return (
        <input
          type="checkbox"
          checked={value === "on"}
          onChange={(e) => onChange(field.name, e.target.checked ? "on" : "")}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
      );

    default:
      return (
        <input
          type={field.field_type === "tel" ? "tel" : "text"}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={field.placeholder || ""}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
        />
      );
  }
}

export function PipelineForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: pipeline, isLoading } = usePipeline(id || "");
  const { data: agents } = useAgents();
  const updatePipeline = useUpdatePipeline();
  const createPipeline = useCreatePipeline();

  const [steps, setSteps] = useState<Step[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(pipelineSchema),
    defaultValues: pipeline
      ? {
          name: pipeline.name,
          steps: pipeline.steps,
        }
      : { name: "", steps: [] },
  });

  // Initialize steps from pipeline data
  if (pipeline && steps.length === 0 && pipeline.steps.length > 0) {
    setSteps(
      pipeline.steps.map((step, i) => ({
        id: `step-${i}`,
        agent_type: step.agent_type,
        config: step.config,
      }))
    );
  }

  const addStep = () => {
    setSteps([
      ...steps,
      { id: `step-${Date.now()}`, agent_type: "", config: {} },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const moveStepUp = (index: number) => {
    if (index > 0) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index - 1]] = [
        newSteps[index - 1],
        newSteps[index],
      ];
      setSteps(newSteps);
    }
  };

  const moveStepDown = (index: number) => {
    if (index < steps.length - 1) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index + 1]] = [
        newSteps[index + 1],
        newSteps[index],
      ];
      setSteps(newSteps);
    }
  };

  const updateStepAgent = (index: number, agentType: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], agent_type: agentType };
    setSteps(newSteps);
  };

  const onSubmit = (data: PipelineInput) => {
    const pipelineData = {
      ...data,
      steps: steps.map((step) => ({
        agent_type: step.agent_type,
        config: step.config,
      })),
    };

    if (id) {
      updatePipeline.mutate(
        { id, data: pipelineData },
        { onSuccess: () => navigate("/pipelines") }
      );
    } else {
      createPipeline.mutate(pipelineData, {
        onSuccess: () => navigate("/pipelines"),
      });
    }
  };

  if (isLoading && id) {
    return (
      <Layout title={id ? "Edit Pipeline" : "New Pipeline"}>
        <div className="text-center py-12">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout title={id ? "Edit Pipeline" : "New Pipeline"}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Pipeline Name"
          {...register("name")}
          error={errors.name?.message}
          placeholder="My pipeline"
        />

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Steps</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addStep}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Step
            </Button>
          </div>

          {steps.map((step, index) => (
            <div
              key={step.id}
              className="border border-gray-200 rounded-lg p-4 mb-4"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-sm font-medium text-gray-700">
                  Step {index + 1}
                </h3>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => moveStepUp(index)}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => moveStepDown(index)}
                    disabled={index === steps.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <select
                value={step.agent_type}
                onChange={(e) => updateStepAgent(index, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— select agent —</option>
                {agents?.map((agent: { name: string; label: string }) => (
                  <option key={agent.name} value={agent.name}>
                    {agent.label}
                  </option>
                ))}
              </select>

              {step.agent_type && (
                <div className="mt-3">
                  <AgentFields
                    agentType={step.agent_type}
                    config={step.config}
                    onChange={(field, value) => {
                      const newSteps = [...steps];
                      newSteps[index] = {
                        ...newSteps[index],
                        config: { ...newSteps[index].config, [field]: value },
                      };
                      setSteps(newSteps);
                    }}
                  />
                </div>
              )}
            </div>
          ))}

          {steps.length === 0 && (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              No steps yet. Click "Add Step" to get started.
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          <Button
            type="submit"
            disabled={updatePipeline.isPending || createPipeline.isPending}
          >
            {updatePipeline.isPending || createPipeline.isPending
              ? "Saving..."
              : "Save Pipeline"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/pipelines")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Layout>
  );
}
