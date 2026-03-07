// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NeedFormDialog from "./NeedFormDialog";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/auth/FormErrorAlert", () => ({
  FormErrorAlert: ({ message }: { message: string }) => <div role="alert">{message}</div>,
}));

vi.mock("./AIGenerateButton", () => ({
  default: ({ type }: { type: string }) => <button type="button">AI {type}</button>,
}));

vi.mock("@/components/ui/select", async () => {
  const ReactModule = await import("react");

  function collectNodes(
    node: React.ReactNode,
    state: {
      triggerProps?: { id?: string; "aria-invalid"?: boolean };
      options: { value: string; label: React.ReactNode }[];
    }
  ) {
    ReactModule.Children.forEach(node, (child) => {
      if (!ReactModule.isValidElement(child)) {
        return;
      }

      if (child.type === SelectTrigger) {
        state.triggerProps = {
          id: child.props.id,
          "aria-invalid": child.props["aria-invalid"],
        };
      }

      if (child.type === SelectItem) {
        state.options.push({ value: child.props.value, label: child.props.children });
      }

      if (child.props.children) {
        collectNodes(child.props.children, state);
      }
    });
  }

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) {
    const state: {
      triggerProps?: { id?: string; "aria-invalid"?: boolean };
      options: { value: string; label: React.ReactNode }[];
    } = {
      options: [],
    };
    collectNodes(children, state);

    return (
      <label>
        <span className="sr-only">select</span>
        <select
          id={state.triggerProps?.id}
          aria-invalid={state.triggerProps?.["aria-invalid"]}
          value={value ?? ""}
          onChange={(event) => onValueChange?.(event.target.value)}
        >
          <option value="">Wybierz</option>
          {state.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {children}
      </label>
    );
  }

  function SelectTrigger(_props: { id?: string; "aria-invalid"?: boolean; children?: React.ReactNode }) {
    return null;
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }

  function SelectItem(_props: { value: string; children: React.ReactNode }) {
    return null;
  }

  function SelectValue(_props: { placeholder?: string }) {
    return null;
  }

  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
});

function renderDialog(overrideProps: Partial<React.ComponentProps<typeof NeedFormDialog>> = {}) {
  const props: React.ComponentProps<typeof NeedFormDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    mode: "create",
    initialData: null,
    shelterId: "shelter-1",
    onSuccess: vi.fn(),
    aiUsageCount: 0,
    aiUsageLimit: 5,
    onAiUsageIncremented: vi.fn(),
    ...overrideProps,
  };

  return {
    ...render(<NeedFormDialog {...props} />),
    props,
  };
}

const createdNeedResponse = {
  id: "need-created",
  shelter_id: "shelter-1",
  category: "food",
  title: "Karma premium",
  description: null,
  shopping_url: null,
  urgency: "normal",
  target_quantity: 12,
  current_quantity: 0,
  unit: "pcs",
  is_fulfilled: false,
  progress_percentage: 0,
  created_at: "2026-03-06T10:00:00Z",
  updated_at: "2026-03-06T10:00:00Z",
};

describe("NeedFormDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.toastSuccess.mockClear();
    mocks.toastError.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows validation errors and skips request when required fields are missing", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Dodaj potrzebę" }));

    expect(await screen.findByText("Wybierz kategorię.")).toBeTruthy();
    expect(screen.getByText("Tytuł jest wymagany.")).toBeTruthy();
    expect(screen.getByText("Ilość docelowa jest wymagana.")).toBeTruthy();
    expect(screen.getByText("Wybierz jednostkę.")).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("creates a need, calls onSuccess and switches dialog into edit mode", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(createdNeedResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { props } = renderDialog();
    const comboBoxes = screen.getAllByRole("combobox");

    expect(comboBoxes).toHaveLength(3);

    await user.selectOptions(comboBoxes[0], "food");
    await user.type(screen.getByLabelText("Tytuł"), "Karma premium");
    await user.type(screen.getByLabelText("Ilość docelowa"), "12");
    await user.selectOptions(comboBoxes[2], "pcs");

    await user.click(screen.getByRole("button", { name: "Dodaj potrzebę" }));

    await waitFor(() => {
      expect(props.onSuccess).toHaveBeenCalledWith(createdNeedResponse);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/needs",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Potrzeba została utworzona. Możesz teraz użyć AI.");
    expect(await screen.findByText("Edytuj potrzebę")).toBeTruthy();
    expect(screen.getByLabelText("Ilość bieżąca")).toBeTruthy();
  });

  it("loads edit details and blocks save when no changes were made", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(createdNeedResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    renderDialog({
      mode: "edit",
      initialData: {
        id: "need-created",
        shelter_id: "shelter-1",
        category: "food",
        title: "placeholder",
        description: null,
        shopping_url: null,
        urgency: "normal",
        target_quantity: 12,
        current_quantity: 0,
        unit: "pcs",
        is_fulfilled: false,
        progress_percentage: 0,
        created_at: "2026-03-06T10:00:00Z",
        updated_at: "2026-03-06T10:00:00Z",
      },
    });

    expect(await screen.findByDisplayValue("Karma premium")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(await screen.findByText("Wprowadź przynajmniej jedną zmianę przed zapisaniem.")).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
