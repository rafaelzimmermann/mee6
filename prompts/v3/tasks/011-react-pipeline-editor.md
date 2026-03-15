# Task 011 — React Pipeline Editor

## Goal

Implement the Pipelines list page and the Pipeline editor page. The editor
supports create and edit, renders agent fields data-driven from the schema API,
and allows drag-to-reorder steps with `@dnd-kit/core`. Includes a `usePipelines`
hook and React Testing Library component specs.

---

## Prerequisites

- Task 010 complete: `AppShell`, all UI primitives, API client layer, React
  Query, and toast helpers are available.
- Task 005 or later complete: Rails `GET /api/v1/pipelines` and
  `GET /api/v1/agents/schema` endpoints exist and return data.

---

## Implementation steps

### 1. Install additional dependencies

```bash
cd rails/frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom vitest jsdom
```

Add to `vite.config.ts`:

```ts
test: {
  environment: "jsdom",
  globals: true,
  setupFiles: "./src/test/setup.ts",
}
```

**`src/test/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

---

### 2. `usePipelines` hook

**`src/hooks/usePipelines.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pipelinesApi } from "../api/pipelines";
import { showSuccess, showError } from "../lib/toast";
import type { Pipeline } from "../api/types";

export function usePipelines() {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["pipelines"],
    queryFn: pipelinesApi.list,
  });

  const create = useMutation({
    mutationFn: pipelinesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      showSuccess("Pipeline created");
    },
    onError: (err: Error) => showError(err.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pipeline> }) =>
      pipelinesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      showSuccess("Pipeline saved");
    },
    onError: (err: Error) => showError(err.message),
  });

  const remove = useMutation({
    mutationFn: pipelinesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      showSuccess("Pipeline deleted");
    },
    onError: (err: Error) => showError(err.message),
  });

  const runNow = useMutation({
    mutationFn: pipelinesApi.runNow,
    onSuccess: () => showSuccess("Pipeline run triggered"),
    onError: (err: Error) => showError(err.message),
  });

  return { list, create, update, remove, runNow };
}
```

---

### 3. `useAgentSchema` hook

**`src/hooks/useAgentSchema.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";

export function useAgentSchema() {
  return useQuery({
    queryKey: ["agent_schema"],
    queryFn: agentsApi.getSchema,
    staleTime: Infinity,   // schema is static; fetch once per app load
  });
}
```

---

### 4. PipelinesPage

**`src/pages/PipelinesPage.tsx`**

```tsx
import { usePipelines } from "../hooks/usePipelines";
import { Table, Th, Td, Tr } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useNavigate } from "react-router-dom";

export function PipelinesPage() {
  const navigate = useNavigate();
  const { list, remove, runNow } = usePipelines();

  if (list.isLoading) return <LoadingSpinner />;

  if (!list.data?.length) {
    return (
      <EmptyState
        message="No pipelines yet"
        cta={{ label: "Create Pipeline", onClick: () => navigate("/pipelines/new") }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>Pipelines</h1>
        <Button onClick={() => navigate("/pipelines/new")}>New Pipeline</Button>
      </div>

      <Table>
        <thead>
          <Tr>
            <Th>Name</Th>
            <Th>Steps</Th>
            <Th>Actions</Th>
          </Tr>
        </thead>
        <tbody>
          {list.data.map((pipeline) => (
            <Tr key={pipeline.id}>
              <Td>{pipeline.name}</Td>
              <Td>{pipeline.pipeline_steps.length}</Td>
              <Td>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/pipelines/${pipeline.id}/edit`)}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => runNow.mutate(pipeline.id)}>
                  Run Now
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove.mutate(pipeline.id)}>
                  Delete
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
```

---

### 5. FieldRenderer component

**`src/components/pipeline/FieldRenderer.tsx`**

Maps `field_type` to the correct UI component. Receives the `FieldSchema` plus
the current value and an `onChange` callback. For `calendar_select` and
`group_select` it fetches options from the respective APIs.

```tsx
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
    label: field.label,
    placeholder: field.placeholder,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(e.target.value),
    error,
  };

  switch (field.field_type) {
    case "textarea":
      return <Textarea {...commonProps} />;

    case "text":
    case "tel":
      return <Input {...commonProps} type={field.field_type} />;

    case "select":
      return (
        <Select
          {...commonProps}
          options={field.options.map((o) => ({ value: o, label: o }))}
        />
      );

    case "combobox":
      // Free-text input with datalist for suggestions
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
```

---

### 6. StepCard component

**`src/components/pipeline/StepCard.tsx`**

```tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FieldRenderer } from "./FieldRenderer";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import type { SchemaResponse } from "../../api/types";

interface StepCardProps {
  id: string;            // unique string id for dnd-kit (use index-based or uuid)
  stepIndex: number;
  agentType: string;
  config: Record<string, string>;
  schema: SchemaResponse;
  errors: Record<string, string>;
  onAgentTypeChange: (type: string) => void;
  onConfigChange: (field: string, value: string) => void;
  onRemove: () => void;
}

export function StepCard({
  id, stepIndex, agentType, config, schema, errors,
  onAgentTypeChange, onConfigChange, onRemove,
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
      {/* Drag handle */}
      <span {...attributes} {...listeners} className="drag-handle" aria-label="Drag to reorder">⠿</span>

      <span className="step-number">Step {stepIndex + 1}</span>

      <Select
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
          onChange={(val) => onConfigChange(field.name, val)}
          error={errors[field.name]}
        />
      ))}

      <Button size="sm" variant="danger" onClick={onRemove}>
        Remove Step
      </Button>
    </div>
  );
}
```

---

### 7. PipelineEditPage

**`src/pages/PipelineEditPage.tsx`**

Handles both create (`/pipelines/new`) and edit (`/pipelines/:id/edit`).

```tsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
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
  dndId: string;       // stable id for dnd-kit
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

  // Populate form when editing an existing pipeline
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

  // Unsaved changes blocker
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
```

---

### 8. Component specs

All specs live in `src/components/pipeline/__tests__/` and
`src/pages/__tests__/`. Use `vitest` + React Testing Library.

Mock the API client module so no real HTTP calls are made:

```ts
// In each test file or a shared mock setup:
vi.mock("../../api/pipelines", () => ({
  pipelinesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    runNow: vi.fn(),
  },
}));

vi.mock("../../api/agents", () => ({
  agentsApi: {
    getSchema: vi.fn().mockResolvedValue({
      llm_agent: {
        label: "LLM Agent",
        fields: [
          { name: "prompt", label: "Prompt", field_type: "textarea", placeholder: "", options: [], required: true },
        ],
      },
    }),
  },
}));
```

#### `PipelinesPage.test.tsx` — key cases

- Renders `LoadingSpinner` when `list.isLoading` is true
- Renders `EmptyState` with "Create Pipeline" CTA when list is empty
- Renders a table row for each pipeline in the list
- Delete button calls `pipelinesApi.delete` with the correct pipeline id
- Edit button navigates to `/pipelines/:id/edit`
- "New Pipeline" button navigates to `/pipelines/new`

#### `PipelineEditPage.test.tsx` — key cases

- Renders pipeline name input
- "Add Step" button appends a new StepCard to the list
- StepCard "Remove Step" button removes that step from the list
- Selecting an agent type from the dropdown renders the correct fields for that agent
- Saving with empty name shows validation error "Pipeline name is required"
- Saving with valid data calls `pipelinesApi.create` (for new) or `pipelinesApi.update` (for edit)
- Success toast fires after save
- Loading state is shown on the save button while mutation is pending

#### `StepCard.test.tsx` — key cases

- Renders step number label
- Agent type dropdown contains all keys from schema
- Changing agent type clears previous config fields and renders new ones
- FieldRenderer renders `textarea` for `field_type: "textarea"`

#### `FieldRenderer.test.tsx` — key cases

- `field_type: "textarea"` renders a `<textarea>`
- `field_type: "text"` renders an `<input type="text">`
- `field_type: "tel"` renders an `<input type="tel">`
- `field_type: "select"` renders a `<select>` with correct options
- `field_type: "calendar_select"` fetches calendars and renders them as options
- `field_type: "group_select"` fetches groups and renders them as options

---

## File / class list

| Path | Description |
|---|---|
| `src/hooks/usePipelines.ts` | React Query mutations + queries for Pipeline CRUD |
| `src/hooks/useAgentSchema.ts` | Fetches and caches agent schema (staleTime: Infinity) |
| `src/pages/PipelinesPage.tsx` | Table of pipelines with edit/delete/run actions |
| `src/pages/PipelineEditPage.tsx` | Create/edit form with DnD step reorder |
| `src/components/pipeline/StepCard.tsx` | Single step card with drag handle and field rendering |
| `src/components/pipeline/FieldRenderer.tsx` | Maps `field_type` to UI component |
| `src/components/pipeline/__tests__/StepCard.test.tsx` | StepCard component specs |
| `src/components/pipeline/__tests__/FieldRenderer.test.tsx` | FieldRenderer component specs |
| `src/pages/__tests__/PipelinesPage.test.tsx` | PipelinesPage specs |
| `src/pages/__tests__/PipelineEditPage.test.tsx` | PipelineEditPage specs |

---

## Acceptance criteria

- [ ] Navigating to `/pipelines` shows a table of pipelines with name, step count, and action buttons
- [ ] Clicking "New Pipeline" opens `/pipelines/new` with an empty form
- [ ] Adding a step renders a StepCard with an agent type dropdown
- [ ] Selecting `llm_agent` from the dropdown renders a "Prompt" textarea field
- [ ] Selecting `calendar_agent` from the dropdown renders a "Calendar" select field populated from the calendars API
- [ ] Dragging a step card reorders the step list
- [ ] Saving with no name shows inline validation error; no API call is made
- [ ] Saving a valid form calls the create or update API and navigates back to `/pipelines`
- [ ] Success toast appears after a successful save
- [ ] Navigating away with unsaved changes shows a confirmation dialog
- [ ] Editing an existing pipeline pre-populates all fields from the existing data
- [ ] `npx vitest run` passes all component specs with zero failures
