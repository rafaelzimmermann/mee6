import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TriggerForm } from "../TriggerForm";
import { whatsappApi } from "../../../api/integrations/whatsapp";
import { pipelinesApi } from "../../../api/pipelines";

vi.mock("../../../api/integrations/whatsapp");
vi.mock("../../../api/pipelines");

const mockSubmit = vi.fn();

describe("TriggerForm", () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    user = userEvent.setup();
    mockSubmit.mockClear();
    vi.mocked(whatsappApi.groups).mockResolvedValue([
      { jid: "123@g.us", name: "Test Group", label: "Test" },
    ]);
    vi.mocked(pipelinesApi.list).mockResolvedValue([
      { id: "pipeline-1", name: "Pipeline 1", pipeline_steps: [], created_at: "", updated_at: "" },
      { id: "pipeline-2", name: "Pipeline 2", pipeline_steps: [], created_at: "", updated_at: "" },
    ]);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithProviders() {
    return render(
      <QueryClientProvider client={queryClient}>
        <TriggerForm onSubmit={mockSubmit} isSubmitting={false} />
      </QueryClientProvider>
    );
  }

  it("selecting 'Cron Schedule' renders cron expression input", async () => {
    renderWithProviders();
    
    const triggerTypeSelect = screen.getByLabelText(/trigger type/i);
    await user.selectOptions(triggerTypeSelect, "cron");

    expect(screen.getByLabelText(/cron expression/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/group/i)).not.toBeInTheDocument();
  });

  it("entering a valid cron expression renders a human-readable preview below the field", async () => {
    renderWithProviders();
    
    const cronInput = screen.getByLabelText(/cron expression/i);
    await user.type(cronInput, "0 8 * * *");

    await waitFor(() => {
      expect(screen.getByText(/at 08:00/i)).toBeInTheDocument();
    });
  });

  it("entering an invalid cron expression renders an error message", async () => {
    renderWithProviders();
    
    const cronInput = screen.getByLabelText(/cron expression/i);
    await user.type(cronInput, "invalid");

    await waitFor(() => {
      expect(screen.getByText(/invalid cron expression/i)).toBeInTheDocument();
    });
  });

  it("selecting 'WhatsApp DM' renders phone number input; cron expression input is absent", async () => {
    renderWithProviders();
    
    const triggerTypeSelect = screen.getByLabelText(/trigger type/i);
    await user.selectOptions(triggerTypeSelect, "whatsapp");

    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/cron expression/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/group/i)).not.toBeInTheDocument();
  });

  it("selecting 'WhatsApp Group' renders group selector; cron expression input is absent", async () => {
    renderWithProviders();
    
    const triggerTypeSelect = screen.getByLabelText(/trigger type/i);
    await user.selectOptions(triggerTypeSelect, "wa_group");

    expect(screen.getByLabelText(/group/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/cron expression/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
  });

  it("submitting with no pipeline selected shows validation error", async () => {
    renderWithProviders();
    
    const submitButton = screen.getByRole("button", { name: /create trigger/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/pipeline is required/i)).toBeInTheDocument();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("submitting a valid cron form calls onSubmit with correct shape including cron_expr", async () => {
    renderWithProviders();
    
    const triggerTypeSelect = screen.getByLabelText(/trigger type/i);
    await user.selectOptions(triggerTypeSelect, "cron");

    const cronInput = screen.getByLabelText(/cron expression/i);
    await user.type(cronInput, "0 9 * * *");

    const pipelineSelect = screen.getByLabelText(/pipeline/i);
    await user.selectOptions(pipelineSelect, "pipeline-1");

    const submitButton = screen.getByRole("button", { name: /create trigger/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        pipeline_id: "pipeline-1",
        trigger_type: "cron",
        cron_expr: "0 9 * * *",
        config: {},
        enabled: true,
      });
    });
  });

  it("submitting a valid WhatsApp DM form calls onSubmit with config.phone set", async () => {
    renderWithProviders();
    
    const triggerTypeSelect = screen.getByLabelText(/trigger type/i);
    await user.selectOptions(triggerTypeSelect, "whatsapp");

    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.type(phoneInput, "+15550001234");

    const pipelineSelect = screen.getByLabelText(/pipeline/i);
    await user.selectOptions(pipelineSelect, "pipeline-1");

    const submitButton = screen.getByRole("button", { name: /create trigger/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        pipeline_id: "pipeline-1",
        trigger_type: "whatsapp",
        cron_expr: undefined,
        config: { phone: "+15550001234" },
        enabled: true,
      });
    });
  });
});
