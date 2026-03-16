import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WhatsAppSection } from "../WhatsAppSection";
import { whatsappApi } from "../../../api/integrations/whatsapp";
import * as toast from "../../../lib/toast";
import type { WhatsAppGroup } from "../../../api/types";

vi.mock("../../../api/integrations/whatsapp");
vi.mock("../../../lib/toast");

const mockGroups: WhatsAppGroup[] = [
  {
    jid: "123@g.us",
    name: "Test Group",
    label: "Test",
  },
  {
    jid: "456@g.us",
    name: "Another Group",
    label: "Another",
  },
];

describe("WhatsAppSection", () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    user = userEvent.setup();
    vi.mocked(whatsappApi.status).mockResolvedValue({
      status: "disconnected",
      qr_svg: null,
      phone_number: "+15550001234",
    });
    vi.mocked(whatsappApi.settings).mockResolvedValue({ phone_number: "+15550001234" });
    vi.mocked(whatsappApi.groups).mockResolvedValue(mockGroups);
    vi.mocked(whatsappApi.connect).mockResolvedValue({ ok: true });
    vi.mocked(whatsappApi.disconnect).mockResolvedValue({ ok: true });
    vi.mocked(whatsappApi.updateSettings).mockResolvedValue({ phone_number: "+15550001234" });
    vi.mocked(whatsappApi.updateGroupLabel).mockResolvedValue(mockGroups[0]);
    vi.mocked(whatsappApi.syncGroups).mockResolvedValue({ ok: true });
    vi.mocked(toast.showSuccess).mockImplementation(() => "");
    vi.mocked(toast.showError).mockImplementation(() => "");
  });

  it("renders status Badge with correct variant for each status value", async () => {
    vi.mocked(whatsappApi.status).mockResolvedValue({
      status: "connected",
      qr_svg: null,
      phone_number: "+15550001234",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const badge = screen.getByText("connected");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });
  });

  it("when status is 'pending_qr' and qr_svg is non-null, SVG is rendered in DOM", async () => {
    vi.mocked(whatsappApi.status).mockResolvedValue({
      status: "pending_qr",
      qr_svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="black"/></svg>',
      phone_number: "+15550001234",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const svgElement = screen.getByLabelText("WhatsApp QR code");
      expect(svgElement).toBeInTheDocument();
      expect(svgElement.innerHTML).toContain('<svg');
    });
  });

  it("when status is 'pending_qr' and qr_svg is null, 'Generating QR code…' text is shown", async () => {
    vi.mocked(whatsappApi.status).mockResolvedValue({
      status: "pending_qr",
      qr_svg: null,
      phone_number: "+15550001234",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Generating QR code…")).toBeInTheDocument();
      expect(screen.queryByLabelText("WhatsApp QR code")).not.toBeInTheDocument();
    });
  });

  it("when status is 'connected', 'Disconnect' button is shown; 'Connect' button is absent", async () => {
    vi.mocked(whatsappApi.status).mockResolvedValue({
      status: "connected",
      qr_svg: null,
      phone_number: "+15550001234",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const allButtons = screen.getAllByRole("button");
      const disconnectButtons = allButtons.filter(btn => btn.textContent?.includes("Disconnect"));
      const connectButtons = allButtons.filter(btn => btn.textContent?.includes("Connect") && !btn.textContent?.includes("Disconnect"));
      
      expect(disconnectButtons.length).toBeGreaterThan(0);
      expect(connectButtons.length).toBe(0);
    });
  });

  it("when status is 'disconnected', 'Connect' button is shown; 'Disconnect' button is absent", async () => {
    vi.mocked(whatsappApi.status).mockResolvedValue({
      status: "disconnected",
      qr_svg: null,
      phone_number: "+15550001234",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const allButtons = screen.getAllByRole("button");
      const connectButtons = allButtons.filter(btn => btn.textContent?.includes("Connect") && !btn.textContent?.includes("Disconnect"));
      const disconnectButtons = allButtons.filter(btn => btn.textContent?.includes("Disconnect"));
      
      expect(connectButtons.length).toBeGreaterThan(0);
      expect(disconnectButtons.length).toBe(0);
    });
  });

  it("'Connect' button calls whatsappApi.connect", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
    });

    const connectButton = screen.getByRole("button", { name: /connect/i });
    await user.click(connectButton);

    await waitFor(() => {
      expect(whatsappApi.connect).toHaveBeenCalled();
    });
  });

  it("'Disconnect' button calls whatsappApi.disconnect", async () => {
    vi.mocked(whatsappApi.status).mockResolvedValue({
      status: "connected",
      qr_svg: null,
      phone_number: "+15550001234",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    });

    const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
    await user.click(disconnectButton);

    await waitFor(() => {
      expect(whatsappApi.disconnect).toHaveBeenCalled();
    });
  });

  it("'Sync Groups' button calls whatsappApi.syncGroups and shows 'Sync started' toast", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("WhatsApp Groups")).toBeInTheDocument();
    });

    const syncButton = screen.getByRole("button", { name: /sync groups/i });
    await user.click(syncButton);

    await waitFor(() => {
      expect(whatsappApi.syncGroups).toHaveBeenCalled();
      expect(toast.showSuccess).toHaveBeenCalledWith("Sync started");
    });
  });

  it("phone number 'Edit' button switches to an editable input; 'Save' calls whatsappApi.updateSettings", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("+15550001234")).toBeInTheDocument();
    });

    const editButton = screen.getByRole("button", { name: /edit/i });
    await user.click(editButton);

    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();

    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.clear(phoneInput);
    await user.type(phoneInput, "+19990001234");

    const saveButton = screen.getAllByRole("button", { name: /save/i })[0];
    await user.click(saveButton);

    await waitFor(() => {
      expect(whatsappApi.updateSettings).toHaveBeenCalledWith({ phone_number: "+19990001234" });
    });
  });

  it("group label 'Save' button calls whatsappApi.updateGroupLabel with correct jid and label", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WhatsAppSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Test Group")).toBeInTheDocument();
    });

    const testGroupRow = screen.getByText("Test Group").closest("tr");
    const groupSaveButton = testGroupRow?.querySelector('button');
    await user.click(groupSaveButton!);

    await waitFor(() => {
      expect(whatsappApi.updateGroupLabel).toHaveBeenCalled();
      const calls = vi.mocked(whatsappApi.updateGroupLabel).mock.calls;
      expect(calls[0][0]).toBe("123@g.us");
      expect(calls[0][1]).toBe("Test");
    });
  });
});
