// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdminPendingSheltersHeader from "./AdminPendingSheltersHeader";

describe("AdminPendingSheltersHeader", () => {
  it("renders the pending queue summary with singular and plural-safe copy", () => {
    const { rerender } = render(
      <AdminPendingSheltersHeader pendingCount={1} isRefreshing={false} onRefresh={vi.fn()} />
    );

    expect(screen.getByText("1 zgłoszenie oczekujące")).toBeTruthy();

    rerender(<AdminPendingSheltersHeader pendingCount={5} isRefreshing={false} onRefresh={vi.fn()} />);

    expect(screen.getByText("5 zgłoszeń oczekujących")).toBeTruthy();
  });

  it("calls refresh and shows the refreshing label", () => {
    const onRefresh = vi.fn();
    const { rerender } = render(
      <AdminPendingSheltersHeader pendingCount={3} isRefreshing={false} onRefresh={onRefresh} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Odśwież" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(<AdminPendingSheltersHeader pendingCount={3} isRefreshing={true} onRefresh={onRefresh} />);

    expect(screen.getByRole("button", { name: "Odświeżanie..." }).hasAttribute("disabled")).toBe(true);
  });
});
