import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TriggersPage } from "../TriggersPage";
import { triggersApi } from "../../api/triggers";
import { pipelinesApi } from "../../api/pipelines";
import * as toast from "../../lib/toast";
import type { Trigger } from "../../api/types";

vi.mock("../../api/triggers");
vi.mock("../../api/pipelines");
vi.mock("../../lib/toast");

const mockTriggers: Trigger[] = [
  {
    id: "1",
    pipeline_id: "pipeline-1",
    pipeline_name: "Morning Report",
    trigger_type: "cron",
    cron_expr: "0 8 * * *",
    config: {},
    enabled: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    pipeline_id: "pipeline-2",
    pipeline_name: "Weekly Summary",
    trigger_type: "whatsapp",
    cron_expr: null,
    config: { phone: "+15550001234" },
    enabled: false,
    created_at: "2024-01-02T00:00:00Z",
  },
];

describe("TriggersPage", () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    user = userEvent.setup();
    vi.mocked(triggersApi.list).mockResolvedValue(mockTriggers);
    vi.mocked(triggersApi.create).mockResolvedValue({
      ...mockTriggers[0],
      id: "3",
    } as Trigger);
    vi.mocked(triggersApi.delete).mockResolvedValue(undefined);
    vi.mocked(triggersApi.toggle).mockResolvedValue({
      ...mockTriggers[0],
      enabled: false,
    } as Trigger);
    vi.mocked(triggersApi.runNow).mockResolvedValue({ ok: true });
    vi.mocked(pipelinesApi.list).mockResolvedValue([
      { id: "pipeline-1", name: "Pipeline 1", pipeline_steps: [], created_at: "", updated_at: "" },
    ]);
    vi.mocked(toast.showSuccess).mockImplementation(() => "");
    vi.mocked(toast.showError).mockImplementation(() => "");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderWithProviders() {
    return render(
      <QueryClientProvider client={queryClient}>
        <TriggersPage />
      </QueryClientProvider>
    );
  }

  it("renders LoadingSpinner while loading", () => {
    vi.mocked(triggersApi.list).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders();

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("renders EmptyState when list is empty", async () => {
    vi.mocked(triggersApi.list).mockResolvedValue([]);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/no triggers yet/i)).toBeInTheDocument();
    });
  });

  it("renders a row for each trigger with type badge, schedule/contact column", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Morning Report")).toBeInTheDocument();
      expect(screen.getByText("Weekly Summary")).toBeInTheDocument();
    });

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2 data rows

    const cronRow = within(rows[1]);
    expect(cronRow.getByText("cron")).toBeInTheDocument();
    expect(cronRow.getByText("0 8 * * *")).toBeInTheDocument();

    const whatsappRow = within(rows[2]);
    expect(whatsappRow.getByText("whatsapp")).toBeInTheDocument();
    expect(whatsappRow.getByText("+15550001234")).toBeInTheDocument();
  });

  it("toggle checkbox calls triggersApi.toggle with correct id and new enabled value", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Morning Report")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    const firstCheckbox = checkboxes[0];
    expect(firstCheckbox).toBeChecked();

    await user.click(firstCheckbox);

    await waitFor(() => {
      expect(triggersApi.toggle).toHaveBeenCalledWith("1", false);
    });
  });

  it("toggle checkbox updates the UI immediately (optimistic update) without waiting for server", async () => {
    let resolveToggle: (value: Trigger) => void;
    vi.mocked(triggersApi.toggle).mockImplementation(
      () => new Promise((resolve) => { resolveToggle = resolve as (value: Trigger) => void; })
    );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Morning Report")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    const firstCheckbox = checkboxes[0];

    await user.click(firstCheckbox);

    expect(firstCheckbox).not.toBeChecked();

    await waitFor(() => {
      resolveToggle!({ ...mockTriggers[0], enabled: false });
    });

    expect(triggersApi.toggle).toHaveBeenCalledWith("1", false);
  });

  it("'Run Now' button calls triggersApi.runNow with the trigger id", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Morning Report")).toBeInTheDocument();
    });

    const runNowButtons = screen.getAllByRole("button", { name: /run now/i });
    await user.click(runNowButtons[0]);

    await waitFor(() => {
      expect(triggersApi.runNow).toHaveBeenCalled();
      const calls = vi.mocked(triggersApi.runNow).mock.calls;
      expect(calls[0][0]).toBe("1");
    });
  });

  it("'Delete' button calls triggersApi.delete with the trigger id", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Morning Report")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(triggersApi.delete).toHaveBeenCalled();
      const calls = vi.mocked(triggersApi.delete).mock.calls;
      expect(calls[0][0]).toBe("1");
    });
  });

  it("'New Trigger' button opens the modal", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Morning Report")).toBeInTheDocument();
    });

    const newTriggerButton = screen.getByRole("button", { name: /new trigger/i });
    await user.click(newTriggerButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toHaveTextContent("New Trigger");
    });
  });

  it("modal closes after successful form submission", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Morning Report")).toBeInTheDocument();
    });

    const newTriggerButton = screen.getByRole("button", { name: /new trigger/i });
    await user.click(newTriggerButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out the form with valid data
    const triggerTypeSelect = screen.getByLabelText(/trigger type/i);
    await user.selectOptions(triggerTypeSelect, "cron");

    const cronInput = screen.getByLabelText(/cron expression/i);
    await user.type(cronInput, "0 8 * * *");

    const pipelineSelect = screen.getByLabelText(/pipeline/i);
    await user.selectOptions(pipelineSelect, "pipeline-1");

    const submitButton = screen.getByRole("button", { name: /create trigger/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
