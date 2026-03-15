import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";
import { pipelinesApi } from "../api/pipelines";
import { usePipelines } from "../hooks/usePipelines";
import { useAgentSchema } from "../hooks/useAgentSchema";
import { StepCard } from "../components/pipeline/StepCard";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

interface StepDraft {
  dndId: string;
  agent_type: string;
  config: Record<string, string>;
}

export function PipelineEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const { create, update } = usePipelines();
  const { data: schema, isLoading: schemaLoading } = useAgentSchema();

  const { data: existing, isLoading: pipelineLoading } = useQuery({
    queryKey: ["pipelines", id],
    queryFn: () => pipelinesApi.get(id!),
    enabled: !isNew,
  });

  const [name, setName] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSteps(
        existing.pipeline_steps.map((s, i) => ({
          dndId: `step-${i}`,
          agent_type: s.agent_type,
          config: Object.fromEntries(
            Object.entries(s.config).map(([k, v]) => [k, String(v)])
          ),
        }))
      );
    }
  }, [existing]);

  const blocker = useBlocker(isDirty);
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm("You have unsaved changes. Leave anyway?")) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSteps((prev) => {
        const oldIndex = prev.findIndex((s) => s.dndId === active.id);
        const newIndex = prev.findIndex((s) => s.dndId === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      markDirty();
    }
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { dndId: `step-${Date.now()}`, agent_type: "", config: {} },
    ]);
    markDirty();
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  }

  function updateStepAgentType(index: number, agentType: string) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, agent_type: agentType, config: {} } : s))
    );
    markDirty();
  }

  function updateStepConfig(index: number, field: string, value: string) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, config: { ...s.config, [field]: value } } : s
      )
    );
    markDirty();
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Pipeline name is required";
    steps.forEach((step, i) => {
      if (!step.agent_type) newErrors[`step_${i}_agent_type`] = "Agent type required";
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    const payload = {
      name: name.trim(),
      pipeline_steps_attributes: steps.map((s, i) => ({
        step_index: i,
        agent_type: s.agent_type,
        config: s.config,
      })),
    };

    if (isNew) {
      await create.mutateAsync(payload);
    } else {
      await update.mutateAsync({ id: id!, data: payload });
    }

    setIsDirty(false);
    navigate("/pipelines");
  }

  if (schemaLoading || (!isNew && pipelineLoading)) return <LoadingSpinner />;
  if (!schema) return <p>Failed to load agent schema.</p>;

  const isSaving = create.isPending || update.isPending;

  return (
    <div>
      <h1>{isNew ? "New Pipeline" : "Edit Pipeline"}</h1>

      <Input
        id="name"
        label="Pipeline Name"
        value={name}
        onChange={(e) => { setName(e.target.value); markDirty(); }}
        error={errors.name}
        placeholder="My Pipeline"
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={steps.map((s) => s.dndId)}
          strategy={verticalListSortingStrategy}
        >
          {steps.map((step, index) => (
            <StepCard
              key={step.dndId}
              id={step.dndId}
              stepIndex={index}
              agentType={step.agent_type}
              config={step.config}
              schema={schema}
              errors={{
                agent_type: errors[`step_${index}_agent_type`] ?? "",
              }}
              onAgentTypeChange={(type) => updateStepAgentType(index, type)}
              onConfigChange={(field, value) => updateStepConfig(index, field, value)}
              onRemove={() => removeStep(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button variant="secondary" onClick={addStep}>
        + Add Step
      </Button>

      <Button onClick={handleSave} loading={isSaving} disabled={isSaving}>
        {isNew ? "Create Pipeline" : "Save Changes"}
      </Button>
    </div>
  );
}
