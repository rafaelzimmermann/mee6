import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PipelineEditPage } from "../PipelineEditPage";
import * as pipelinesApiMock from "../../api/pipelines";
import userEvent from "@testing-library/user-event";
import { vi as viActual } from "vitest";

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
    getSchema: vi.fn(),
  },
}));

vi.mock("../../hooks/useAgentSchema", () => ({
  useAgentSchema: () => ({
    data: mockSchema,
    isLoading: false,
  }),
}));

vi.mock("../../lib/toast", () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await viActual.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useBlocker: vi.fn(() => ({ state: "unblocked", proceed: vi.fn(), reset: vi.fn() })),
  };
});

const mockSchema = {
  llm_agent: {
    label: "LLM Agent",
    fields: [
      {
        name: "prompt",
        label: "Prompt",
        field_type: "textarea" as const,
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
        field_type: "calendar_select" as const,
        placeholder: "",
        options: [],
        required: true,
      },
    ],
  },
};

describe("PipelineEditPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();
  });

  function renderPage(path: string) {
    const result = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/pipelines/new" element={<PipelineEditPage />} />
            <Route path="/pipelines/:id/edit" element={<PipelineEditPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    return result;
  }

  it("renders pipeline name input", async () => {
    const { container } = renderPage("/pipelines/new");

    await waitFor(() => {
      expect(screen.getByText("New Pipeline")).toBeInTheDocument();
    });

    const label = container.querySelector("label[for='name']");
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe("Pipeline Name");

    const input = container.querySelector("input#name");
    expect(input).not.toBeNull();
  });

  it("renders New Pipeline heading for new pipeline", async () => {
    renderPage("/pipelines/new");

    await waitFor(() => {
      expect(screen.getByText("New Pipeline")).toBeInTheDocument();
    });
  });

  it("renders Edit Pipeline heading for editing existing pipeline", async () => {
    vi.spyOn(pipelinesApiMock.pipelinesApi, "get").mockResolvedValue({
      id: "123",
      name: "Existing Pipeline",
      pipeline_steps: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    renderPage("/pipelines/123/edit");

    await waitFor(() => {
      expect(screen.getByText("Edit Pipeline")).toBeInTheDocument();
    });
  });

  it("adds a new StepCard when Add Step button is clicked", async () => {
    renderPage("/pipelines/new");

    await waitFor(() => {
      expect(screen.getByText("New Pipeline")).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: "+ Add Step" });
    addButton.click();

    await waitFor(() => {
      expect(screen.getByText("Step 1")).toBeInTheDocument();
    });
  });

  it("removes a step when Remove Step button is clicked", async () => {
    renderPage("/pipelines/new");

    await waitFor(() => {
      expect(screen.getByText("New Pipeline")).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: "+ Add Step" });
    addButton.click();
    addButton.click();

    await waitFor(() => {
      expect(screen.getByText("Step 1")).toBeInTheDocument();
      expect(screen.getByText("Step 2")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button", { name: "Remove Step" });
    removeButtons[0].click();

    await waitFor(() => {
      expect(screen.queryByText("Step 2")).not.toBeInTheDocument();
      expect(screen.getByText("Step 1")).toBeInTheDocument(); // The second step is now Step 1
    });
  });

  it("renders Prompt textarea when llm_agent is selected", async () => {
    renderPage("/pipelines/new");

    await waitFor(() => {
      expect(screen.getByText("New Pipeline")).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: "+ Add Step" });
    addButton.click();

    await waitFor(() => screen.getByRole("combobox"));
    const agentSelect = screen.getByRole("combobox");
    await userEvent.selectOptions(agentSelect, "llm_agent");

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText("Enter prompt");
      expect(textarea.tagName).toBe("TEXTAREA");
    });
  });

  it("shows validation error when saving with empty name", async () => {
    renderPage("/pipelines/new");

    await waitFor(() => {
      expect(screen.getByText("New Pipeline")).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: "Create Pipeline" });
    saveButton.click();

    await waitFor(() => {
      expect(screen.getByText("Pipeline name is required")).toBeInTheDocument();
    });

    expect(pipelinesApiMock.pipelinesApi.create).not.toHaveBeenCalled();
  });

  it("calls pipelinesApi.create with valid data for new pipeline", async () => {
    const createMock = vi.spyOn(pipelinesApiMock.pipelinesApi, "create").mockResolvedValue({
      id: "new-pipeline",
      name: "New Pipeline",
      pipeline_steps: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    renderPage("/pipelines/new");

    await waitFor(() => {
      expect(screen.getByText("New Pipeline")).toBeInTheDocument();
    });

    const nameInput = screen.getByRole("textbox", { name: /pipeline name/i });
    await userEvent.type(nameInput, "Test Pipeline");

    const saveButton = screen.getByRole("button", { name: "Create Pipeline" });
    saveButton.click();

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: "Test Pipeline",
        pipeline_steps_attributes: [],
      });
    });
  });

  it("calls pipelinesApi.update with valid data for existing pipeline", async () => {
    vi.spyOn(pipelinesApiMock.pipelinesApi, "get").mockResolvedValue({
      id: "123",
      name: "Existing Pipeline",
      pipeline_steps: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const updateMock = vi.spyOn(pipelinesApiMock.pipelinesApi, "update").mockResolvedValue({
      id: "123",
      name: "Updated Pipeline",
      pipeline_steps: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    renderPage("/pipelines/123/edit");

    await waitFor(() => {
      expect(screen.getByText("Edit Pipeline")).toBeInTheDocument();
    });

    const nameInput = screen.getByRole("textbox", { name: /pipeline name/i });
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Pipeline");

    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    saveButton.click();

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith("123", {
        name: "Updated Pipeline",
        pipeline_steps_attributes: [],
      });
    });
  });

  it("shows loading state on save button while mutation is pending", async () => {
    vi.spyOn(pipelinesApiMock.pipelinesApi, "create").mockImplementation(
      () => new Promise(() => {})
    );

    renderPage("/pipelines/new");

    await waitFor(() => {
      expect(screen.getByText("New Pipeline")).toBeInTheDocument();
    });

    const nameInput = screen.getByRole("textbox", { name: /pipeline name/i });
    await userEvent.type(nameInput, "Test Pipeline");

    const saveButton = screen.getByRole("button", { name: "Create Pipeline" });
    saveButton.click();

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
  });
});
