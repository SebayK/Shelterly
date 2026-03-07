// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ShelterReviewPanel from "./ShelterReviewPanel";
import type { ShelterReviewVM, VerificationDocumentState } from "./types";

const previewProps = vi.hoisted(() => ({
  state: null as VerificationDocumentState | null,
  shelterName: null as string | null,
  onRetry: vi.fn(),
  onDownload: vi.fn(),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./VerificationDocumentPreview", () => ({
  default: (props: {
    state: VerificationDocumentState;
    shelterName: string;
    onRetry: () => void;
    onDownload: () => void;
  }) => {
    previewProps.state = props.state;
    previewProps.shelterName = props.shelterName;
    previewProps.onRetry = props.onRetry;
    previewProps.onDownload = props.onDownload;

    return <div data-testid="verification-document-preview">preview</div>;
  },
}));

const shelter: ShelterReviewVM = {
  id: "shelter-1",
  name: "Azyl Testowy",
  nip: "1234567890",
  city: "Warszawa",
  email: "admin@test.pl",
  createdAt: "2026-03-07T08:00:00Z",
  createdAtLabel: "7 mar 2026, 09:00",
  verificationDocumentPath: "docs/verification.pdf",
  hasVerificationDocument: true,
};

const documentState: VerificationDocumentState = {
  status: "success",
  objectUrl: "blob:preview",
  contentType: "application/pdf",
  fileName: "verification.pdf",
  errorMessage: null,
};

function renderPanel(overrideProps: Partial<React.ComponentProps<typeof ShelterReviewPanel>> = {}) {
  const props: React.ComponentProps<typeof ShelterReviewPanel> = {
    open: true,
    shelter,
    documentState,
    actionState: {
      isSubmitting: false,
      pendingDecision: null,
    },
    onOpenChange: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onRetryDocument: vi.fn(),
    onDownloadDocument: vi.fn(),
    actionsDisabledReason: undefined,
    ...overrideProps,
  };

  render(<ShelterReviewPanel {...props} />);

  return props;
}

describe("ShelterReviewPanel", () => {
  it("renders shelter details and passes document preview props", () => {
    renderPanel();

    expect(screen.getByText("Azyl Testowy")).toBeTruthy();
    expect(screen.getByText("ID profilu: shelter-1")).toBeTruthy();
    expect(screen.getByText("1234567890")).toBeTruthy();
    expect(screen.getByText("Warszawa")).toBeTruthy();
    expect(screen.getByText("admin@test.pl")).toBeTruthy();
    expect(screen.getByText("7 mar 2026, 09:00")).toBeTruthy();
    expect(screen.getByTestId("verification-document-preview")).toBeTruthy();
    expect(previewProps.state).toEqual(documentState);
    expect(previewProps.shelterName).toBe("Azyl Testowy");
  });

  it("disables actions and shows the blocking reason when decisions are unavailable", () => {
    renderPanel({ actionsDisabledReason: "Decyzje są zablokowane do czasu dodania dokumentu." });

    expect(screen.getByText("Decyzje są zablokowane do czasu dodania dokumentu.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Odrzuć zgłoszenie" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Zatwierdź schronisko" }).hasAttribute("disabled")).toBe(true);
  });

  it("forwards review actions to the provided callbacks", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Odrzuć zgłoszenie" }));
    fireEvent.click(screen.getByRole("button", { name: "Zatwierdź schronisko" }));

    expect(props.onReject).toHaveBeenCalledTimes(1);
    expect(props.onApprove).toHaveBeenCalledTimes(1);
  });

  it("shows an empty-state message when no shelter is selected", () => {
    renderPanel({ shelter: null });

    expect(screen.getByText("Brak aktywnie wybranego zgłoszenia.")).toBeTruthy();
    expect(screen.queryByTestId("verification-document-preview")).toBeNull();
  });
});
