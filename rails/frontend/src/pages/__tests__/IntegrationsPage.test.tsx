import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntegrationsPage } from "../IntegrationsPage";

describe("IntegrationsPage", () => {
  let user: ReturnType<typeof userEvent.setup>;
  let queryClient: QueryClient;

  beforeEach(() => {
    user = userEvent.setup();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("renders three tab buttons: Memories, Calendars, WhatsApp", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegrationsPage />
      </QueryClientProvider>
    );

    expect(screen.getByRole("tab", { name: "Memories" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Calendars" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "WhatsApp" })).toBeInTheDocument();
  });

  it("default tab is Memories", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegrationsPage />
      </QueryClientProvider>
    );

    const memoriesTab = screen.getByRole("tab", { name: "Memories" });
    expect(memoriesTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Memories")).toBeInTheDocument();
  });

  it("clicking 'Calendars' tab renders CalendarsSection content", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegrationsPage />
      </QueryClientProvider>
    );

    const calendarsTab = screen.getByRole("tab", { name: "Calendars" });
    await user.click(calendarsTab);

    expect(calendarsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("Calendars").length).toBeGreaterThan(1);
  });

  it("clicking 'WhatsApp' tab renders WhatsAppSection content", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegrationsPage />
      </QueryClientProvider>
    );

    const whatsappTab = screen.getByRole("tab", { name: "WhatsApp" });
    await user.click(whatsappTab);

    expect(whatsappTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("WhatsApp").length).toBeGreaterThan(1);
  });
});
