// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NeedActions from "./NeedActions";

vi.mock("./DisabledActionTooltip", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

describe("NeedActions", () => {
  it("disables edit and fulfill actions for fulfilled needs", () => {
    render(
      <NeedActions onEdit={vi.fn()} onDelete={vi.fn()} onFulfill={vi.fn()} isDisabled={false} isFulfilled={true} />
    );

    expect(screen.getByRole("button", { name: /edytuj/i })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /oznacz jako zrealizowaną/i })).toHaveProperty("disabled", true);
    expect(screen.getByText("Ta potrzeba jest już zrealizowana.")).toBeTruthy();
  });

  it("keeps delete available for fulfilled needs", () => {
    const onDelete = vi.fn();

    render(
      <NeedActions onEdit={vi.fn()} onDelete={onDelete} onFulfill={vi.fn()} isDisabled={false} isFulfilled={true} />
    );

    const deleteButton = screen.getByRole("button", { name: /usuń/i });
    expect(deleteButton).toHaveProperty("disabled", false);

    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
