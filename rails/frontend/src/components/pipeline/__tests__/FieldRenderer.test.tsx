import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldRenderer } from "../FieldRenderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../api/integrations/calendars", () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: "cal1", label: "Primary Calendar" },
      { id: "cal2", label: "Secondary Calendar" },
    ]),
  },
}));

vi.mock("../../../api/integrations/whatsapp", () => ({
  whatsappApi: {
    groups: vi.fn().mockResolvedValue([
      { jid: "group1", name: "Test Group", label: "Test Group" },
      { jid: "group2", name: "Another Group" },
    ]),
  },
}));

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

describe("FieldRenderer", () => {
  const baseField = {
    name: "test_field",
    label: "Test Field",
    placeholder: "Enter value",
    options: [],
    required: false,
  };

  it('renders a <textarea> for field_type: "textarea"', () => {
    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "textarea" }}
        value=""
        onChange={vi.fn()}
      />
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it('renders an <input type="text"> for field_type: "text"', () => {
    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "text" }}
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("type", "text");
  });

  it('renders an <input type="tel"> for field_type: "tel"', () => {
    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "tel" }}
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("type", "tel");
  });

  it('renders a <select> with correct options for field_type: "select"', () => {
    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "select", options: ["Option1", "Option2"] }}
        value=""
        onChange={vi.fn()}
      />
    );

    const select = screen.getByRole("combobox");
    expect(select.tagName).toBe("SELECT");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveValue("Option1");
    expect(options[1]).toHaveValue("Option2");
  });

  it('renders an <input> with datalist for field_type: "combobox"', () => {
    const { container } = renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "combobox", options: ["Opt1", "Opt2"] }}
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole("combobox");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("list", "datalist-test_field");

    const datalist = container.querySelector("#datalist-test_field");
    expect(datalist).not.toBeNull();
    expect(datalist?.tagName).toBe("DATALIST");
  });

  it('renders a <select> with calendar options for field_type: "calendar_select"', async () => {
    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "calendar_select" }}
        value=""
        onChange={vi.fn()}
      />
    );

    await queryClient.refetchQueries({ queryKey: ["calendars"] });

    const select = screen.getByRole("combobox");
    expect(select.tagName).toBe("SELECT");
  });

  it('renders a <select> with group options for field_type: "group_select"', async () => {
    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "group_select" }}
        value=""
        onChange={vi.fn()}
      />
    );

    await queryClient.refetchQueries({ queryKey: ["whatsapp_groups"] });

    const select = screen.getByRole("combobox");
    expect(select.tagName).toBe("SELECT");
  });

  it("calls onChange when input value changes", async () => {
    const handleChange = vi.fn();

    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "text" }}
        value=""
        onChange={handleChange}
      />
    );

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "test");

    expect(handleChange).toHaveBeenCalled();
  });

  it("shows placeholder chips below textarea fields", () => {
    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "textarea" }}
        value=""
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTitle("Previous step's output")).toBeInTheDocument();
    expect(screen.getByTitle("Current date & time (YYYY-MM-DD HH:MM)")).toBeInTheDocument();
    expect(screen.getByTitle(/Memory contents/)).toBeInTheDocument();
  });

  it("copies placeholder text to clipboard on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "textarea" }}
        value=""
        onChange={vi.fn()}
      />
    );

    await userEvent.click(screen.getByTitle("Previous step's output"));
    expect(writeText).toHaveBeenCalledWith("{input}");
  });

  it("displays error message when provided", () => {
    renderWithProviders(
      <FieldRenderer
        field={{ ...baseField, field_type: "text" }}
        value=""
        onChange={vi.fn()}
        error="This field is required"
      />
    );

    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });
});
