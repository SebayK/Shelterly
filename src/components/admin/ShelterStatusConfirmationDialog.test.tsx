// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ShelterStatusConfirmationDialog from "./ShelterStatusConfirmationDialog";

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

describe("ShelterStatusConfirmationDialog", () => {
  it("renders rejection reason textarea and forwards typed value", () => {
    const onRejectionReasonChange = vi.fn();

    render(
      <ShelterStatusConfirmationDialog
        open={true}
        mode="rejected"
        shelterName="Azyl Testowy"
        rejectionReason=""
        rejectionReasonError={null}
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onRejectionReasonChange={onRejectionReasonChange}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Wpisz powód odrzucenia"), {
      target: { value: "Brak poprawnego dokumentu" },
    });

    expect(screen.getByText(/Azyl Testowy/i)).toBeTruthy();
    expect(screen.getByText("Powód odrzucenia")).toBeTruthy();
    expect(screen.getByText("Wpisz minimum 3 znaki i maksymalnie 500 znaków.")).toBeTruthy();
    expect(onRejectionReasonChange).toHaveBeenCalledWith("Brak poprawnego dokumentu");
  });

  it("moves focus to the rejection reason field and binds validation text for screen readers", () => {
    render(
      <ShelterStatusConfirmationDialog
        open={true}
        mode="rejected"
        shelterName="Azyl Testowy"
        rejectionReason=""
        rejectionReasonError="Powód odrzucenia jest wymagany."
        isSubmitting={false}
        onOpenChange={vi.fn()}
        onRejectionReasonChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const textarea = screen.getByRole("textbox");
    const describedBy = textarea.getAttribute("aria-describedby");

    expect(document.activeElement).toBe(textarea);
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(describedBy).toBeTruthy();

    const describedElement = describedBy ? document.getElementById(describedBy) : null;
    expect(describedElement?.textContent).toBe("Powód odrzucenia jest wymagany.");
  });

  it("disables actions while the mutation is pending", () => {
    render(
      <ShelterStatusConfirmationDialog
        open={true}
        mode="verified"
        shelterName="Azyl Testowy"
        rejectionReason=""
        rejectionReasonError={null}
        isSubmitting={true}
        onOpenChange={vi.fn()}
        onRejectionReasonChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Zapisywanie..." })).toHaveProperty("disabled", true);
  });
});
