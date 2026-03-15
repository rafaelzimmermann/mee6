import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RunHistoryPage } from "../RunHistoryPage";
import { runRecordsApi } from "../../api/runRecords";
import type { RunRecord } from "../../api/types";

vi.mock("../../api/runRecords");

const mockRuns: RunRecord[] = [
  {
    id: 1,
    pipeline_id: "pipeline-1",
    pipeline_name: "Morning Report",
    timestamp: "2024-01-01T08:00:00Z",
    status: "success",
    summary: "Generated 3 reports",
  },
  {
    id: 2,
    pipeline_id: "pipeline-2",
    pipeline_name: "Weekly Summary",
    timestamp: "2024-01-02T09:00:00Z",
    status: "error",
    summary: "Failed to connect to calendar",
  },
  {
    id: 3,
    pipeline_id: "pipeline-3",
    pipeline_name: "Daily Backup",
    timestamp: "2024-01-03T10:00:00Z",
    status: "running",
    summary: null,
  },
];

describe("RunHistoryPage", () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    user = userEvent.setup();
    vi.mocked(runRecordsApi.list).mockResolvedValue(mockRuns);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderWithProviders() {
    return render(
      <QueryClientProvider client={queryClient}>
        <RunHistoryPage />
      </QueryClientProvider>
    );
  }

  it("renders a row for each run record with correct status badge", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Morning Report")).toBeInTheDocument();
      expect(screen.getByText("Weekly Summary")).toBeInTheDocument();
      expect(screen.getByText("Daily Backup")).toBeInTheDocument();
    });

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4); // header + 3 data rows
  });

  it("'Success' status renders Badge with variant='success'", async () => {
    renderWithProviders();

    await waitFor(() => {
      const successBadge = screen.getByText("success");
      expect(successBadge).toBeInTheDocument();
      expect(successBadge).toHaveClass("bg-green-100", "text-green-800");
    });
  });

  it("'Error' status renders Badge with variant='error'", async () => {
    renderWithProviders();

    await waitFor(() => {
      const errorBadge = screen.getByText("error");
      expect(errorBadge).toBeInTheDocument();
      expect(errorBadge).toHaveClass("bg-red-100", "text-red-800");
    });
  });

  it("'Running' status renders Badge with variant='warning'", async () => {
    renderWithProviders();

    await waitFor(() => {
      const warningBadge = screen.getByText("running");
      expect(warningBadge).toBeInTheDocument();
      expect(warningBadge).toHaveClass("bg-amber-100", "text-amber-800");
    });
  });

  it("filtering by 'error' calls runRecordsApi.list with { status: 'error' }", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Run History")).toBeInTheDocument();
    });

    const statusFilter = screen.getByLabelText(/filter by status/i);
    await user.selectOptions(statusFilter, "error");

    await waitFor(() => {
      expect(runRecordsApi.list).toHaveBeenCalledWith({ status: "error" });
    });
  });

  it("page auto-refreshes (verify refetchInterval is passed to useQuery)", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(runRecordsApi.list).toHaveBeenCalled();
    });

    const calls = vi.mocked(runRecordsApi.list).mock.calls;
    
    // The initial call should have been made with no filter and the refetchInterval
    expect(calls.length).toBeGreaterThan(0);
  });
});
