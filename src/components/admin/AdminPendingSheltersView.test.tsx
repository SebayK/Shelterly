// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPendingSheltersView from "./AdminPendingSheltersView";
import { AdminRequestError } from "./admin.helpers";
import type { PendingShelterListItemDTO } from "@/types";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(async () => undefined),
  updateStatus: vi.fn(async () => ({ id: "shelter-1", status: "verified", updated_at: "2026-03-07T09:00:00Z" })),
  retryDocument: vi.fn(),
  downloadDocument: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  shelters: [] as PendingShelterListItemDTO[],
  rows: [] as {
    id: string;
    name: string;
    nip: string;
    city: string;
    email: string;
    createdAt: string;
    createdAtLabel: string;
    hasVerificationDocument: boolean;
    documentStatusLabel: string;
  }[],
}));

const pendingShelter: PendingShelterListItemDTO = {
  id: "shelter-1",
  name: "Azyl Testowy",
  nip: "1234567890",
  city: "Warszawa",
  email: "admin@test.pl",
  verification_doc_path: "docs/verification.pdf",
  created_at: "2026-03-07T08:00:00Z",
};

const pendingShelterWithoutDocument: PendingShelterListItemDTO = {
  ...pendingShelter,
  id: "shelter-2",
  name: "Azyl Bez Dokumentu",
  verification_doc_path: null,
};

vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
  },
}));

vi.mock("@/components/hooks/useAdminPendingShelters", () => ({
  useAdminPendingShelters: () => ({
    shelters: mocks.shelters,
    rows: mocks.rows,
    pagination: { total: 1, page: 1, pageSize: 10, totalPages: 1, from: 1, to: 1 },
    isLoading: false,
    isRefreshing: false,
    error: null,
    refetch: mocks.refetch,
  }),
}));

vi.mock("@/components/hooks/useShelterVerificationDocument", () => ({
  useShelterVerificationDocument: () => ({
    documentState: {
      status: "success",
      objectUrl: "blob:mock-url",
      contentType: "application/pdf",
      fileName: "verification.pdf",
      errorMessage: null,
    },
    retry: mocks.retryDocument,
    download: mocks.downloadDocument,
  }),
}));

vi.mock("@/components/hooks/useUpdateShelterStatus", () => ({
  useUpdateShelterStatus: () => ({
    updateStatus: mocks.updateStatus,
    isPending: false,
    errorMessage: null,
  }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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

describe("AdminPendingSheltersView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateStatus.mockResolvedValue({ id: "shelter-1", status: "verified", updated_at: "2026-03-07T09:00:00Z" });
    mocks.shelters = [pendingShelter];
    mocks.rows = [
      {
        id: "shelter-1",
        name: "Azyl Testowy",
        nip: "1234567890",
        city: "Warszawa",
        email: "admin@test.pl",
        createdAt: "2026-03-07T08:00:00Z",
        createdAtLabel: "7 mar 2026, 09:00",
        hasVerificationDocument: true,
        documentStatusLabel: "Dokument dostępny",
      },
    ];
  });

  it("selects a row, opens the review panel, and confirms verification", async () => {
    render(
      <AdminPendingSheltersView
        currentUser={{
          id: "admin-1",
          name: "Administrator",
          role: "super_admin",
        }}
      />
    );

    fireEvent.click(screen.getByText("Azyl Testowy"));
    fireEvent.click(screen.getByRole("button", { name: "Zatwierdź schronisko" }));
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź zatwierdzenie" }));

    await waitFor(() => {
      expect(mocks.updateStatus).toHaveBeenCalledWith({
        shelterId: "shelter-1",
        command: { status: "verified" },
      });
    });

    expect(mocks.success).toHaveBeenCalledWith("Schronisko Azyl Testowy zostało zatwierdzone.");
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("submits a rejection with reason and shows the success toast", async () => {
    mocks.updateStatus.mockResolvedValueOnce({
      id: "shelter-1",
      status: "rejected",
      updated_at: "2026-03-07T09:15:00Z",
    });

    render(
      <AdminPendingSheltersView
        currentUser={{
          id: "admin-1",
          name: "Administrator",
          role: "super_admin",
        }}
      />
    );

    fireEvent.click(screen.getByText("Azyl Testowy"));
    fireEvent.click(screen.getByRole("button", { name: "Odrzuć zgłoszenie" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Brak podpisanego dokumentu weryfikacyjnego" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź odrzucenie" }));

    await waitFor(() => {
      expect(mocks.updateStatus).toHaveBeenCalledWith({
        shelterId: "shelter-1",
        command: {
          status: "rejected",
          rejection_reason: "Brak podpisanego dokumentu weryfikacyjnego",
        },
      });
    });

    expect(mocks.success).toHaveBeenCalledWith("Zgłoszenie schroniska Azyl Testowy zostało odrzucone.");
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("shows validation feedback and blocks reject submit without reason", async () => {
    render(
      <AdminPendingSheltersView
        currentUser={{
          id: "admin-1",
          name: "Administrator",
          role: "super_admin",
        }}
      />
    );

    fireEvent.click(screen.getByText("Azyl Testowy"));
    fireEvent.click(screen.getByRole("button", { name: "Odrzuć zgłoszenie" }));
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź odrzucenie" }));

    await waitFor(() => {
      expect(screen.getByText("Powód odrzucenia jest wymagany.")).toBeTruthy();
    });

    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it("refreshes the list and closes the selection when the mutation returns 404", async () => {
    mocks.updateStatus.mockRejectedValueOnce(new AdminRequestError("Shelter not found", 404));

    render(
      <AdminPendingSheltersView
        currentUser={{
          id: "admin-1",
          name: "Administrator",
          role: "super_admin",
        }}
      />
    );

    fireEvent.click(screen.getByText("Azyl Testowy"));
    fireEvent.click(screen.getByRole("button", { name: "Zatwierdź schronisko" }));
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź zatwierdzenie" }));

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledWith("To zgłoszenie nie jest już dostępne. Lista zostanie odświeżona.");
    });

    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("keeps actions disabled for a shelter without a verification document", async () => {
    mocks.shelters = [pendingShelterWithoutDocument];
    mocks.rows = [
      {
        id: "shelter-2",
        name: "Azyl Bez Dokumentu",
        nip: "1234567890",
        city: "Warszawa",
        email: "admin@test.pl",
        createdAt: "2026-03-07T08:00:00Z",
        createdAtLabel: "7 mar 2026, 09:00",
        hasVerificationDocument: false,
        documentStatusLabel: "Brak dokumentu",
      },
    ];

    render(
      <AdminPendingSheltersView
        currentUser={{
          id: "admin-1",
          name: "Administrator",
          role: "super_admin",
        }}
      />
    );

    fireEvent.click(screen.getByText("Azyl Bez Dokumentu"));

    expect(screen.getByRole("button", { name: "Zatwierdź schronisko" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Odrzuć zgłoszenie" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Decyzje są zablokowane, dopóki rekord nie ma dokumentu weryfikacyjnego.")).toBeTruthy();
  });
});
