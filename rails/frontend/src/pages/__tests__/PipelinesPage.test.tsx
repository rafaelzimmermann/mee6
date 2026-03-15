import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PipelinesPage } from "../PipelinesPage";
import * as pipelinesApiMock from "../../api/pipelines";
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
  };
});

describe("PipelinesPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.clearAllMocks();
    navigateMock.mockClear();
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <PipelinesPage />
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  it("renders LoadingSpinner when list.isLoading is true", () => {
    vi.spyOn(pipelinesApiMock.pipelinesApi, "list").mockImplementation(
      () => new Promise(() => {})
    );

    renderPage();

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("renders EmptyState with Create Pipeline CTA when list is empty", async () => {
    vi.spyOn(pipelinesApiMock.pipelinesApi, "list").mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No pipelines yet")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create Pipeline" })).toBeInTheDocument();
    });
  });

  it("renders a table row for each pipeline in the list", async () => {
    const mockPipelines = [
      {
        id: "1",
        name: "Pipeline 1",
        pipeline_steps: [
          { id: 1, pipeline_id: "1", step_index: 0, agent_type: "llm_agent", config: {} },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Pipeline 2",
        pipeline_steps: [
          { id: 2, pipeline_id: "2", step_index: 0, agent_type: "calendar_agent", config: {} },
          { id: 3, pipeline_id: "2", step_index: 1, agent_type: "llm_agent", config: {} },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(pipelinesApiMock.pipelinesApi, "list").mockResolvedValue(mockPipelines);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Pipeline 1")).toBeInTheDocument();
      expect(screen.getByText("Pipeline 2")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument(); // Step count for Pipeline 1
      expect(screen.getByText("2")).toBeInTheDocument(); // Step count for Pipeline 2
    });
  });

  it("navigates to /pipelines/new when New Pipeline button is clicked", async () => {
    vi.spyOn(pipelinesApiMock.pipelinesApi, "list").mockResolvedValue([
      {
        id: "1",
        name: "Existing Pipeline",
        pipeline_steps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    renderPage();

    await waitFor(() => {
      const button = screen.getByRole("button", { name: "New Pipeline" });
      button.click();
    });

    expect(navigateMock).toHaveBeenCalledWith("/pipelines/new");
  });

  it("navigates to /pipelines/:id/edit when Edit button is clicked", async () => {
    const mockPipelines = [
      {
        id: "123",
        name: "Test Pipeline",
        pipeline_steps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(pipelinesApiMock.pipelinesApi, "list").mockResolvedValue(mockPipelines);

    renderPage();

    await waitFor(() => {
      const editButton = screen.getByRole("button", { name: "Edit" });
      editButton.click();
    });

    expect(navigateMock).toHaveBeenCalledWith("/pipelines/123/edit");
  });

  it("calls pipelinesApi.delete when Delete button is clicked", async () => {
    const mockPipelines = [
      {
        id: "456",
        name: "Pipeline to Delete",
        pipeline_steps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const deleteMock = vi.spyOn(pipelinesApiMock.pipelinesApi, "delete").mockResolvedValue(undefined);
    vi.spyOn(pipelinesApiMock.pipelinesApi, "list").mockResolvedValue(mockPipelines);

    renderPage();

    await waitFor(() => {
      const deleteButton = screen.getByRole("button", { name: "Delete" });
      deleteButton.click();
    });

    expect(deleteMock).toHaveBeenCalledWith("456");
  });

  it("calls pipelinesApi.runNow when Run Now button is clicked", async () => {
    const mockPipelines = [
      {
        id: "789",
        name: "Pipeline to Run",
        pipeline_steps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const runNowMock = vi.spyOn(pipelinesApiMock.pipelinesApi, "runNow").mockResolvedValue({ ok: true });
    vi.spyOn(pipelinesApiMock.pipelinesApi, "list").mockResolvedValue(mockPipelines);

    renderPage();

    await waitFor(() => {
      const runButton = screen.getByRole("button", { name: "Run Now" });
      runButton.click();
    });

    expect(runNowMock).toHaveBeenCalledWith("789");
  });
});
