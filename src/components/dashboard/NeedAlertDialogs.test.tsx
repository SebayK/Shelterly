// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeleteNeedAlertDialog from "./DeleteNeedAlertDialog";
import FulfillNeedAlertDialog from "./FulfillNeedAlertDialog";

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
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Need alert dialogs", () => {
  it("prevents implicit close when confirming delete", () => {
    const onConfirm = vi.fn();

    render(
      <DeleteNeedAlertDialog open={true} onOpenChange={vi.fn()} need={null} onConfirm={onConfirm} isDeleting={false} />
    );

    const confirmButton = screen.getByRole("button", { name: "Usuń potrzebę" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    confirmButton.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("prevents implicit close when confirming fulfill", () => {
    const onConfirm = vi.fn();

    render(
      <FulfillNeedAlertDialog
        open={true}
        onOpenChange={vi.fn()}
        need={null}
        onConfirm={onConfirm}
        isFulfilling={false}
      />
    );

    const confirmButton = screen.getByRole("button", { name: "Oznacz jako zrealizowaną" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    confirmButton.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables confirm buttons while mutations are pending", () => {
    render(
      <>
        <DeleteNeedAlertDialog open={true} onOpenChange={vi.fn()} need={null} onConfirm={vi.fn()} isDeleting={true} />
        <FulfillNeedAlertDialog
          open={true}
          onOpenChange={vi.fn()}
          need={null}
          onConfirm={vi.fn()}
          isFulfilling={true}
        />
      </>
    );

    expect(screen.getByRole("button", { name: "Usuwanie..." })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Zapisywanie..." })).toHaveProperty("disabled", true);
  });
});
