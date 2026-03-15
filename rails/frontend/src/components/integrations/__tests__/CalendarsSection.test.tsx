import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CalendarsSection } from "../CalendarsSection";
import { calendarsApi } from "../../../api/integrations/calendars";
import * as toast from "../../../lib/toast";

vi.mock("../../../api/integrations/calendars");
vi.mock("../../../lib/toast");

const mockCalendars = [
  {
    id: "1",
    label: "Work Calendar",
    calendar_id: "user@example.com",
    credentials_file: "/secrets/google_credentials.json",
  },
  {
    id: "2",
    label: "Personal Calendar",
    calendar_id: "personal@gmail.com",
    credentials_file: "/secrets/personal_credentials.json",
  },
];

describe("CalendarsSection", () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    user = userEvent.setup();
    vi.mocked(calendarsApi.list).mockResolvedValue(mockCalendars);
    vi.mocked(calendarsApi.create).mockResolvedValue({
      ...mockCalendars[0],
      id: "3",
    });
    vi.mocked(calendarsApi.delete).mockResolvedValue(undefined);
    vi.mocked(toast.showSuccess).mockImplementation(() => "");
    vi.mocked(toast.showError).mockImplementation(() => "");
  });

  it("renders calendar rows with label, calendar_id, credentials_file", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CalendarsSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Work Calendar")).toBeInTheDocument();
      expect(screen.getByText("Personal Calendar")).toBeInTheDocument();
    });

    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1);
  });

  it("'Add Calendar' button opens modal", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CalendarsSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Work Calendar")).toBeInTheDocument();
    });

    const addCalendarButton = screen.getByRole("button", { name: "Add Calendar" });
    await user.click(addCalendarButton);

    const modal = screen.getByRole("dialog");
    expect(modal).toHaveTextContent("Add Calendar");
  });

  it("submitting valid form calls calendarsApi.create", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CalendarsSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Work Calendar")).toBeInTheDocument();
    });

    const addCalendarButton = screen.getByRole("button", { name: "Add Calendar" });
    await user.click(addCalendarButton);

    const labelInput = screen.getByLabelText(/label/i);
    await user.type(labelInput, "New Calendar");

    const calendarIdInput = screen.getByLabelText(/calendar id/i);
    await user.type(calendarIdInput, "new@example.com");

    const credentialsInput = screen.getByLabelText(/credentials file path/i);
    await user.type(credentialsInput, "/secrets/new_credentials.json");

    const submitButtons = screen.getAllByRole("button", { name: /add/i });
    const modalSubmitButton = submitButtons.find(btn => btn.closest('[role="dialog"]'));
    await user.click(modalSubmitButton!);

    await waitFor(() => {
      expect(calendarsApi.create).toHaveBeenCalled();
    });
  });

  it("delete button calls calendarsApi.delete with calendar id", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CalendarsSection />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Work Calendar")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(calendarsApi.delete).toHaveBeenCalled();
      const calls = vi.mocked(calendarsApi.delete).mock.calls;
      expect(calls[0][0]).toBe("1");
    });
  });
});
