import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StepCard } from "../StepCard";
import type { SchemaResponse } from "../../../api/types";

const mockSchema: SchemaResponse = {
  llm_agent: {
    label: "LLM Agent",
    fields: [
      {
        name: "prompt",
        label: "Prompt",
        field_type: "textarea",
        placeholder: "Enter prompt",
        options: [],
        required: true,
      },
    ],
  },
  calendar_agent: {
    label: "Calendar Agent",
    fields: [
      {
        name: "calendar",
        label: "Calendar",
        field_type: "calendar_select",
        placeholder: "",
        options: [],
        required: true,
      },
    ],
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("StepCard", () => {
  const defaultProps = {
    id: "step-1",
    stepIndex: 0,
    agentType: "",
    config: {},
    schema: mockSchema,
    errors: {},
    onAgentTypeChange: vi.fn(),
    onConfigChange: vi.fn(),
    onRemove: vi.fn(),
  };

  it("renders step number label", () => {
    renderWithProviders(<StepCard {...defaultProps} />);

    expect(screen.getByText("Step 1")).toBeInTheDocument();
  });

  it("renders agent type dropdown with all schema keys", () => {
    renderWithProviders(<StepCard {...defaultProps} />);

    const select = screen.getByLabelText("Agent Type");
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3); // Select agent... + 2 agent types
    expect(options[0]).toHaveTextContent("Select agent…");
    expect(options[1]).toHaveTextContent("LLM Agent");
    expect(options[2]).toHaveTextContent("Calendar Agent");
  });

  it("renders correct fields for llm_agent when selected", () => {
    renderWithProviders(<StepCard {...defaultProps} agentType="llm_agent" />);

    expect(screen.getByLabelText("Prompt")).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText("Enter prompt");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("renders correct fields for calendar_agent when selected", () => {
    renderWithProviders(<StepCard {...defaultProps} agentType="calendar_agent" />);

    expect(screen.getByLabelText("Calendar")).toBeInTheDocument();
  });

  it("calls onAgentTypeChange when agent type is selected", () => {
    const handleChange = vi.fn();
    renderWithProviders(<StepCard {...defaultProps} onAgentTypeChange={handleChange} />);

    const select = screen.getByLabelText("Agent Type");
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("calls onRemove when Remove Step button is clicked", () => {
    const handleRemove = vi.fn();
    renderWithProviders(<StepCard {...defaultProps} onRemove={handleRemove} />);

    const removeButton = screen.getByRole("button", { name: "Remove Step" });
    removeButton.click();

    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it("displays error message for agent_type when provided", () => {
    renderWithProviders(
      <StepCard {...defaultProps} errors={{ agent_type: "Agent type required" }} />
    );

    expect(screen.getByText("Agent type required")).toBeInTheDocument();
  });

  it("has drag handle element", () => {
    renderWithProviders(<StepCard {...defaultProps} />);

    const dragHandle = screen.getByLabelText("Drag to reorder");
    expect(dragHandle).toBeInTheDocument();
    expect(dragHandle).toHaveTextContent("⠿");
  });
});
