// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PendingSheltersPagination from "./PendingSheltersPagination";

describe("PendingSheltersPagination", () => {
  it("uses correct Polish pluralization for result counts", () => {
    const { rerender } = render(
      <PendingSheltersPagination
        pagination={{
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
          from: 1,
          to: 1,
        }}
        isPending={false}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
      />
    );

    expect(screen.getByText("Pokazano 1-1 z 1 zgłoszenie")).toBeTruthy();

    rerender(
      <PendingSheltersPagination
        pagination={{
          total: 2,
          page: 1,
          pageSize: 10,
          totalPages: 1,
          from: 1,
          to: 2,
        }}
        isPending={false}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
      />
    );

    expect(screen.getByText("Pokazano 1-2 z 2 zgłoszenia")).toBeTruthy();

    rerender(
      <PendingSheltersPagination
        pagination={{
          total: 5,
          page: 1,
          pageSize: 10,
          totalPages: 1,
          from: 1,
          to: 5,
        }}
        isPending={false}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
      />
    );

    expect(screen.getByText("Pokazano 1-5 z 5 zgłoszeń")).toBeTruthy();

    rerender(
      <PendingSheltersPagination
        pagination={{
          total: 22,
          page: 3,
          pageSize: 10,
          totalPages: 3,
          from: 21,
          to: 22,
        }}
        isPending={false}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
      />
    );

    expect(screen.getByText("Pokazano 21-22 z 22 zgłoszenia")).toBeTruthy();
  });
});
