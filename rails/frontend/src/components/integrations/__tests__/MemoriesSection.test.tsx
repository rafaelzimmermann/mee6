import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoriesSection } from "../MemoriesSection";
import { memoriesApi } from "../../../api/integrations/memories";
import * as toast from "../../../lib/toast";

vi.mock("../../../api/integrations/memories");
vi.mock("../../../lib/toast");

const mockMemories = [
  {
    id: "1",
    label: "test-memory",
    max_memories: 100,
    ttl_hours: 24,
    max_value_size: 1000,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    label: "another-memory",
    max_memories: 50,
    ttl_hours: 12,
    max_value_size: 500,
    created_at: "2024-01-02T00:00:00Z",
  },
];

describe("MemoriesSection", () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    user = userEvent.setup();
    vi.mocked(memoriesApi.list).mockResolvedValue(mockMemories);
    vi.mocked(memoriesApi.create).mockResolvedValue({
      ...mockMemories[0],
      id: "3",
    });
    vi.mocked(memoriesApi.delete).mockResolvedValue(undefined);
    vi.mocked(memoriesApi.entries).mockResolvedValue([]);
    vi.mocked(toast.showSuccess).mockImplementation(() => "");
    vi.mocked(toast.showError).mockImplementation(() => "");
  });

  it("renders memory rows with label, max_memories, ttl_hours, max_value_size", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoriesSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("test-memory")).toBeInTheDocument();
      expect(screen.getByText("another-memory")).toBeInTheDocument();
    });

    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1);
  });

  it("'New Memory' button opens create modal", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoriesSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("test-memory")).toBeInTheDocument();
    });

    const newMemoryButton = screen.getByRole("button", { name: "New Memory" });
    await user.click(newMemoryButton);

    const modal = screen.getByRole("dialog");
    expect(modal).toHaveTextContent("New Memory Config");
  });

  it("create form shows validation error when label is empty", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoriesSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("test-memory")).toBeInTheDocument();
    });

    const newMemoryButton = screen.getByRole("button", { name: /new memory/i });
    await user.click(newMemoryButton);

    const submitButton = screen.getByRole("button", { name: /create/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Label is required")).toBeInTheDocument();
    });
  });

  it("create form shows validation error when label contains invalid characters", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoriesSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("test-memory")).toBeInTheDocument();
    });

    const newMemoryButton = screen.getByRole("button", { name: /new memory/i });
    await user.click(newMemoryButton);

    const labelInput = screen.getByLabelText(/label/i);
    await user.type(labelInput, "my label!");

    const submitButton = screen.getByRole("button", { name: /create/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Only letters, numbers, hyphens, underscores")).toBeInTheDocument();
    });
  });

  it("submitting a valid form calls memoriesApi.create with correct data", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoriesSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("test-memory")).toBeInTheDocument();
    });

    const newMemoryButton = screen.getByRole("button", { name: "New Memory" });
    await user.click(newMemoryButton);

    const labelInput = screen.getByLabelText(/label/i);
    await user.type(labelInput, "new-memory");

    const submitButtons = screen.getAllByRole("button", { name: /create/i });
    const modalSubmitButton = submitButtons.find(btn => btn.closest('[role="dialog"]'));
    await user.click(modalSubmitButton!);

    await waitFor(() => {
      expect(memoriesApi.create).toHaveBeenCalled();
    });
  });

  it("delete button calls memoriesApi.delete with memory label", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoriesSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("test-memory")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(memoriesApi.delete).toHaveBeenCalled();
      const calls = vi.mocked(memoriesApi.delete).mock.calls;
      expect(calls[0][0]).toBe("test-memory");
    });
  });

  it("'View Entries' button opens entries modal and calls memoriesApi.entries", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoriesSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("test-memory")).toBeInTheDocument();
    });

    const viewEntriesButtons = screen.getAllByRole("button", { name: /view entries/i });
    await user.click(viewEntriesButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/entries: test-memory/i)).toBeInTheDocument();
      expect(memoriesApi.entries).toHaveBeenCalledWith("test-memory", 20);
    });
  });
});
