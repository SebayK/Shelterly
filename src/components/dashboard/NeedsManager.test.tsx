// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NeedsManager from "./NeedsManager";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(async () => undefined),
  nextPage: vi.fn(async () => undefined),
  prevPage: vi.fn(async () => undefined),
  warning: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  useNeeds: vi.fn(),
  redirectToLogin: vi.fn(),
}));

const baseNeed = {
  id: "need-1",
  shelter: {
    id: "shelter-1",
    name: "Schronisko Testowe",
    city: "Warszawa",
  },
  category: "food",
  title: "Karma sucha",
  description: "Duże opakowanie",
  urgency: "normal",
  target_quantity: 10,
  current_quantity: 2,
  unit: "pcs",
  is_fulfilled: false,
  progress_percentage: 20,
  created_at: "2026-03-01T12:00:00Z",
} as const;

vi.mock("sonner", () => ({
  toast: {
    warning: mocks.warning,
    success: mocks.success,
    error: mocks.error,
  },
}));

vi.mock("@/components/hooks/useNeeds", () => ({
  useNeeds: (...args: unknown[]) => mocks.useNeeds(...args),
}));

vi.mock("./request.helpers", async () => {
  const actual = await vi.importActual<typeof import("./request.helpers")>("./request.helpers");

  return {
    ...actual,
    redirectToDashboardLogin: mocks.redirectToLogin,
  };
});

vi.mock("./NeedFormDialog", () => ({
  default: ({ open }: { open: boolean }) => <div data-testid="need-form-dialog">{open ? "open" : "closed"}</div>,
}));

vi.mock("./DeleteNeedAlertDialog", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Potwierdź usunięcie
      </button>
    ) : null,
}));

vi.mock("./FulfillNeedAlertDialog", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Potwierdź realizację
      </button>
    ) : null,
}));

vi.mock("./NeedsTable", () => ({
  default: ({
    needs,
    onDelete,
    onFulfill,
  }: {
    needs: (typeof baseNeed)[];
    onDelete: (need: typeof baseNeed) => void;
    onFulfill: (need: typeof baseNeed) => void;
  }) => (
    <div>
      {needs.map((need) => (
        <div key={need.id}>
          <button type="button" onClick={() => onDelete(need)}>
            Usuń {need.title}
          </button>
          <button type="button" onClick={() => onFulfill(need)}>
            Zrealizuj {need.title}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("./NeedsPagination", () => ({
  default: () => <div>Pagination</div>,
}));

vi.mock("./NeedsTableSkeleton", () => ({
  default: () => <div>Loading</div>,
}));

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.refresh.mockClear();
  mocks.nextPage.mockClear();
  mocks.prevPage.mockClear();
  mocks.warning.mockClear();
  mocks.success.mockClear();
  mocks.error.mockClear();
  mocks.redirectToLogin.mockClear();
  mocks.useNeeds.mockReturnValue({
    needs: [],
    pagination: { total: 0, limit: 10, offset: 0 },
    isLoading: false,
    error: null,
    currentPage: 1,
    totalPages: 1,
    refresh: mocks.refresh,
    nextPage: mocks.nextPage,
    prevPage: mocks.prevPage,
  });
  vi.stubGlobal("fetch", vi.fn());
});

describe("NeedsManager", () => {
  it("opens the create dialog when the verified shelter clicks add", () => {
    render(<NeedsManager profileId="shelter-1" accountStatus="verified" aiUsageCount={1} aiUsageLimit={5} />);

    expect(screen.getByTestId("need-form-dialog").textContent).toBe("closed");

    fireEvent.click(screen.getByRole("button", { name: "Dodaj potrzebę" }));

    expect(screen.getByTestId("need-form-dialog").textContent).toBe("open");
  });

  it("shows a pending-specific disabled message and warning when the shelter is pending", () => {
    mocks.useNeeds.mockReturnValue({
      needs: [baseNeed],
      pagination: { total: 1, limit: 10, offset: 0 },
      isLoading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      refresh: mocks.refresh,
      nextPage: mocks.nextPage,
      prevPage: mocks.prevPage,
    });

    render(<NeedsManager profileId="shelter-1" accountStatus="pending" aiUsageCount={1} aiUsageLimit={5} />);

    expect(
      screen.getAllByText(/Twoje konto oczekuje na weryfikację\. Uzupełnij profil i dołącz dokument/i)
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Dodaj potrzebę" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: /Usuń Karma sucha/i }));

    expect(mocks.warning).toHaveBeenCalledWith("Najpierw dokończ weryfikację konta schroniska.");
  });

  it("shows a rejected-specific disabled message and warning when the shelter is rejected", () => {
    mocks.useNeeds.mockReturnValue({
      needs: [baseNeed],
      pagination: { total: 1, limit: 10, offset: 0 },
      isLoading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      refresh: mocks.refresh,
      nextPage: mocks.nextPage,
      prevPage: mocks.prevPage,
    });

    render(<NeedsManager profileId="shelter-1" accountStatus="rejected" aiUsageCount={1} aiUsageLimit={5} />);

    expect(
      screen.getAllByText(/Twoje konto zostało odrzucone\. Popraw dane profilu i prześlij dokument ponownie/i)
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Dodaj potrzebę" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: /Usuń Karma sucha/i }));

    expect(mocks.warning).toHaveBeenCalledWith("Popraw profil i wyślij dokument ponownie, aby odblokować akcje.");
  });

  it("deletes a need and refreshes the list after confirmation", async () => {
    mocks.useNeeds.mockReturnValue({
      needs: [baseNeed],
      pagination: { total: 1, limit: 10, offset: 0 },
      isLoading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      refresh: mocks.refresh,
      nextPage: mocks.nextPage,
      prevPage: mocks.prevPage,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    render(<NeedsManager profileId="shelter-1" accountStatus="verified" aiUsageCount={1} aiUsageLimit={5} />);

    fireEvent.click(screen.getByRole("button", { name: /Usuń Karma sucha/i }));
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź usunięcie" }));

    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Potrzeba "Karma sucha" została usunięta.');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/needs/need-1",
      expect.objectContaining({ method: "DELETE", signal: expect.any(AbortSignal) })
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("marks a need as fulfilled and refreshes the list", async () => {
    mocks.useNeeds.mockReturnValue({
      needs: [baseNeed],
      pagination: { total: 1, limit: 10, offset: 0 },
      isLoading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      refresh: mocks.refresh,
      nextPage: mocks.nextPage,
      prevPage: mocks.prevPage,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "need-1", is_fulfilled: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    render(<NeedsManager profileId="shelter-1" accountStatus="verified" aiUsageCount={1} aiUsageLimit={5} />);

    fireEvent.click(screen.getByRole("button", { name: /Zrealizuj Karma sucha/i }));
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź realizację" }));

    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Potrzeba "Karma sucha" została oznaczona jako zrealizowana.');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/needs/need-1/fulfill",
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) })
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows mapped API error when delete request fails", async () => {
    mocks.useNeeds.mockReturnValue({
      needs: [baseNeed],
      pagination: { total: 1, limit: 10, offset: 0 },
      isLoading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      refresh: mocks.refresh,
      nextPage: mocks.nextPage,
      prevPage: mocks.prevPage,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Brak dostępu" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    render(<NeedsManager profileId="shelter-1" accountStatus="verified" aiUsageCount={1} aiUsageLimit={5} />);

    fireEvent.click(screen.getByRole("button", { name: /Usuń Karma sucha/i }));
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź usunięcie" }));

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledWith("Nie masz uprawnień do wykonania tej operacji.");
    });

    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("redirects to login when delete request returns 401", async () => {
    mocks.useNeeds.mockReturnValue({
      needs: [baseNeed],
      pagination: { total: 1, limit: 10, offset: 0 },
      isLoading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      refresh: mocks.refresh,
      nextPage: mocks.nextPage,
      prevPage: mocks.prevPage,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Brak sesji" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    render(<NeedsManager profileId="shelter-1" accountStatus="verified" aiUsageCount={1} aiUsageLimit={5} />);

    fireEvent.click(screen.getByRole("button", { name: /Usuń Karma sucha/i }));
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź usunięcie" }));

    await waitFor(() => {
      expect(mocks.redirectToLogin).toHaveBeenCalled();
    });

    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("goes back to previous page when deleting the last item on a later page", async () => {
    mocks.useNeeds.mockReturnValue({
      needs: [baseNeed],
      pagination: { total: 11, limit: 10, offset: 10 },
      isLoading: false,
      error: null,
      currentPage: 2,
      totalPages: 2,
      refresh: mocks.refresh,
      nextPage: mocks.nextPage,
      prevPage: mocks.prevPage,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    render(<NeedsManager profileId="shelter-1" accountStatus="verified" aiUsageCount={1} aiUsageLimit={5} />);

    fireEvent.click(screen.getByRole("button", { name: /Usuń Karma sucha/i }));
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź usunięcie" }));

    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Potrzeba "Karma sucha" została usunięta.');
    });

    expect(mocks.prevPage).toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
